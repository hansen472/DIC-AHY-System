import logging
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)

# 全局单例，避免每次请求都重新加载模型
_ocr = None


def _build_ocr_kwargs():
    """根据 PaddlePaddle 大版本构造初始化参数，避免 3.x 不识别旧参数。"""
    try:
        import paddle
        paddle_major = int(paddle.__version__.split('.')[0])
    except Exception:
        paddle_major = 2

    kwargs = {
        "use_angle_cls": True,
        "lang": "ch",
        "ocr_version": "PP-OCRv3",
        "use_gpu": False,
    }

    # ir_optim / enable_mkldnn / cpu_threads 在 2.6.x 部分 CPU 上可规避 SIGILL，
    # 但在 PaddlePaddle 3.x 中可能不再暴露，因此仅在 2.x 时传入。
    if paddle_major < 3:
        kwargs.update({
            "ir_optim": False,
            "enable_mkldnn": False,
            "cpu_threads": 2,
        })

    return kwargs


def get_ocr():
    """延迟初始化 PaddleOCR（首次加载会下载模型，耗时较久）。"""
    global _ocr
    if _ocr is None:
        logger.info("正在初始化 PaddleOCR 模型...")
        _ocr = PaddleOCR(**_build_ocr_kwargs())
        logger.info("PaddleOCR 初始化完成")
    return _ocr


def recognize_cell(image):
    """
    对单个单元格图片进行 OCR，返回合并后的文本和平均置信度。
    """
    if image is None or image.size == 0:
        return {"text": "", "confidence": 0.0}

    ocr = get_ocr()
    result = ocr.ocr(image, cls=True)

    if not result or result[0] is None:
        return {"text": "", "confidence": 0.0}

    texts = []
    confidences = []
    for line in result[0]:
        # line: [box, (text, confidence)]
        _, (text, conf) = line
        if text:
            texts.append(text)
            confidences.append(conf)

    merged = " ".join(texts).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return {"text": merged, "confidence": round(float(avg_conf), 3)}
