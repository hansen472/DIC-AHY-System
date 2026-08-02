import os
import re
import json
import logging
import tempfile
import base64
from flask import Flask, request, jsonify
import cv2
import numpy as np

from align import detect_table_corners, warp_table, crop_cells
from ocr_engine import recognize_cell
from validator import validate_all

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 默认允许上传 16MB
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

DEFAULT_CONFIDENCE_THRESHOLD = 0.65


def load_json_config(path):
    if not path or not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def parse_config_value(value):
    """解析配置：先尝试 JSON 字符串，失败则当作文件路径加载。"""
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError as e:
        logger.warning(f"config 不是合法 JSON，尝试当作文件路径加载: {e}")
        return load_json_config(value)


def get_config_from_request():
    """
    从 multipart 请求中提取 config：
    1. 优先读取 request.form['config']（字符串字段）
    2. 再尝试读取 request.files['config']（文件字段）
    返回 (raw_value, parsed_config)
    """
    raw = request.form.get('config')
    source = 'form'

    if not raw and 'config' in request.files:
        config_file = request.files['config']
        if config_file.filename:
            raw = config_file.read().decode('utf-8')
            source = 'file'

    logger.info(f"config source={source}, raw type={type(raw)!r}, raw={raw!r}")

    parsed = parse_config_value(raw) if raw else None
    return raw, parsed


def parse_corners(value):
    """
    解析前端传入的四角坐标。
    支持格式：
    - JSON 字符串 [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
    - JSON 字符串 [x1,y1,x2,y2,x3,y3,x4,y4]
    - 逗号分隔的 8 个数字 x1,y1,x2,y2,x3,y3,x4,y4（可带中括号）
    返回 numpy 数组 (4,2)，失败返回 None。
    """
    if not value:
        return None
    value = value.strip()

    # 尝试 JSON：嵌套数组 [[x,y],...] 或扁平数组 [x,y,x,y,...]
    try:
        arr = json.loads(value)
        if isinstance(arr, list):
            flat = []
            for item in arr:
                if isinstance(item, (list, tuple)):
                    flat.extend(item)
                elif isinstance(item, (int, float)):
                    flat.append(item)
            if len(flat) == 8:
                return np.array(flat, dtype="float32").reshape(4, 2)
    except Exception:
        pass

    # 逗号/空白/中括号分隔的 8 个数字
    try:
        nums = [float(x.strip()) for x in re.split(r'[,，\s\[\]]+', value) if x.strip()]
        if len(nums) == 8:
            return np.array(nums, dtype="float32").reshape(4, 2)
    except Exception:
        pass

    logger.warning(f"无法解析四角坐标: {value!r}")
    return None


def save_debug_image(warped, output_dir, filename):
    """调试用：保存矫正后的图片。"""
    try:
        os.makedirs(output_dir, exist_ok=True)
        cv2.imwrite(os.path.join(output_dir, filename), warped)
    except Exception as e:
        logger.warning(f"保存调试图片失败: {e}")


def image_to_base64(image, ext='.jpg'):
    """把 OpenCV 图片编码成 base64 data URI。"""
    if image is None or image.size == 0:
        return None
    try:
        success, buffer = cv2.imencode(ext, image)
        if not success:
            return None
        b64 = base64.b64encode(buffer).decode('utf-8')
        mime = 'image/jpeg' if ext in ('.jpg', '.jpeg') else 'image/png'
        return f"data:{mime};base64,{b64}"
    except Exception as e:
        logger.warning(f"图片转 base64 失败: {e}")
        return None


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


@app.route('/recognize', methods=['POST'])
def recognize():
    if 'image' not in request.files:
        return jsonify({"error": "缺少 image 文件"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "图片文件名为空"}), 400

    # 可选参数
    config_value, config = get_config_from_request()
    expected_aspect = request.form.get('expected_aspect', type=float) or None
    confidence_threshold = request.form.get('confidence_threshold', type=float) or DEFAULT_CONFIDENCE_THRESHOLD
    debug = request.form.get('debug', 'false').lower() == 'true'
    manual_corners = parse_corners(request.form.get('corners'))

    # 加载字段配置
    cells = config.get('fields', []) if isinstance(config, dict) else []
    rules = config.get('validation', {}) if isinstance(config, dict) else {}

    logger.info(f"parsed config type={type(config)!r}, fields count={len(cells)}")

    if not config:
        return jsonify({"error": "未提供字段配置或配置解析失败"}), 400
    if not cells:
        return jsonify({"error": "配置中没有 fields 数组"}), 400

    # 临时保存上传图片
    suffix = os.path.splitext(file.filename)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        image = cv2.imread(tmp_path)
        if image is None:
            return jsonify({"error": "无法读取图片，请确认格式正确"}), 400

        # 1. 检测表格四角（优先使用前端传入的手动四角）
        if manual_corners is not None:
            corners = manual_corners
            logger.info(f"使用手动指定四角: {corners.tolist()}")
        else:
            corners = detect_table_corners(image, expected_aspect=expected_aspect)
        if corners is None:
            return jsonify({"error": "未能检测到表格四角，请确保表格完整、背景对比明显"}), 400

        # 调试用：把检测/手动指定的四角也返回给前端
        corners_list = corners.tolist() if isinstance(corners, np.ndarray) else corners

        # 2. 透视矫正
        warped, (warp_w, warp_h) = warp_table(image, corners)

        if debug:
            debug_dir = os.path.join(os.path.dirname(__file__), 'debug')
            save_debug_image(warped, debug_dir, os.path.basename(tmp_path))

        # 3. 按配置裁剪单元格并识别
        raw_fields = {}
        debug_images = {}
        debug_dir = os.path.join(os.path.dirname(__file__), 'debug')
        for idx, cell_info in enumerate(crop_cells(warped, cells)):
            name = cell_info["name"]
            crop_img = cell_info["image"]

            if debug:
                save_debug_image(crop_img, os.path.join(debug_dir, 'cells'), f"{idx}_{name}.jpg")
                debug_images[name] = image_to_base64(crop_img)

            rec = recognize_cell(crop_img)
            raw_fields[name] = rec
            logger.info(f"字段 [{name}] 识别结果: {rec['text']} (置信度 {rec['confidence']})")

        # 4. 校验
        validated = validate_all(raw_fields, rules)

        overall_passed = all(r["passed"] for r in validated.values())
        low_confidence_fields = [name for name, r in validated.items()
                                 if r["confidence"] < confidence_threshold]

        result = {
            "success": True,
            "image_size": {"width": warp_w, "height": warp_h},
            "corners": corners_list,
            "fields": validated,
            "overall_passed": overall_passed,
            "low_confidence_fields": low_confidence_fields,
            "confidence_threshold": confidence_threshold
        }
        if debug:
            result["debug_images"] = debug_images

        return jsonify(result)

    except Exception as e:
        logger.exception("识别过程出错")
        return jsonify({"error": f"识别失败: {str(e)}"}), 500
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


if __name__ == '__main__':
    port = int(os.environ.get('OCR_SERVICE_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
