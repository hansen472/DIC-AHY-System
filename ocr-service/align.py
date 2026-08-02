import cv2
import numpy as np


def order_points(pts):
    """把四个角点按左上、右上、右下、左下排序。"""
    pts = np.array(pts, dtype="float32")
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)

    tl = pts[np.argmin(s)]      # 左上角 x+y 最小
    br = pts[np.argmax(s)]      # 右下角 x+y 最大
    tr = pts[np.argmin(diff)]   # 右上角 x-y 最小
    bl = pts[np.argmax(diff)]   # 左下角 x-y 最大
    return np.array([tl, tr, br, bl], dtype="float32")


def detect_table_corners(image, expected_aspect=None, aspect_tol=0.5):
    """
    在照片中检测最可能是表格的四边形四个角点。
    :param image: BGR 图片 (numpy array)
    :param expected_aspect: 表格宽/高比，例如 A4 竖版约 0.707；传 None 时自动按最大轮廓估计
    :param aspect_tol: 允许的长宽比偏差
    :return: 4x2 角点数组，如果没找到返回 None
    """
    if image is None or image.size == 0:
        return None

    orig_h, orig_w = image.shape[:2]
    # 先缩放到一个合适尺寸做边缘检测，避免原图过大
    scale = 800.0 / max(orig_w, orig_h)
    if scale < 1.0:
        resized = cv2.resize(image, None, fx=scale, fy=scale)
    else:
        resized = image.copy()
        scale = 1.0

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 尝试 Canny 和自适应阈值两种方案，返回更合理的四边形
    candidates = []
    edged_variants = [
        cv2.Canny(blurred, 50, 150),
        cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                              cv2.THRESH_BINARY_INV, 11, 2)
    ]
    # 对二值图做闭运算，把断开的外框线连起来，降低漏掉顶部标题行的概率
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    for i, edged in enumerate(edged_variants):
        if i == 1:
            edged = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel, iterations=2)
        cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = sorted(cnts, key=cv2.contourArea, reverse=True)

        for c in cnts[:8]:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                pts = approx.reshape(4, 2).astype("float32")
                # 映射回原图坐标
                pts = pts / scale
                candidates.append(pts)
                break

    if not candidates:
        return None

    # 如果有预期长宽比，选最接近的；否则选面积最大（轮廓最显著）的
    def aspect_ratio(pts):
        ordered = order_points(pts)
        w1 = np.linalg.norm(ordered[1] - ordered[0])
        w2 = np.linalg.norm(ordered[2] - ordered[3])
        h1 = np.linalg.norm(ordered[3] - ordered[0])
        h2 = np.linalg.norm(ordered[2] - ordered[1])
        return max(w1, w2) / max(h1, h2) if max(h1, h2) > 0 else 0

    if expected_aspect:
        best = min(candidates, key=lambda pts: abs(aspect_ratio(pts) - expected_aspect))
        if abs(aspect_ratio(best) - expected_aspect) > aspect_tol * expected_aspect:
            # 如果偏差过大，回退到最大轮廓
            best = max(candidates, key=lambda pts: cv2.contourArea(pts.astype(np.int32)))
    else:
        best = max(candidates, key=lambda pts: cv2.contourArea(pts.astype(np.int32)))

    return order_points(best)


def warp_table(image, pts, target_width=None, target_height=None):
    """
    把检测到的四边形区域做透视变换，得到正视图。
    """
    ordered = order_points(pts)
    tl, tr, br, bl = ordered

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)

    width = int(max(width_a, width_b))
    height = int(max(height_a, height_b))

    if target_width and target_height:
        width, height = target_width, target_height

    dst = np.array([
        [0, 0],
        [width - 1, 0],
        [width - 1, height - 1],
        [0, height - 1]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(ordered, dst)
    warped = cv2.warpPerspective(image, M, (width, height))
    return warped, (width, height)


def crop_cells(warped, cells):
    """
    根据相对坐标（占正视图宽高的比例）裁剪单元格。
    :param warped: 矫正后的正视图
    :param cells: [{name, x, y, w, h}, ...]，x/y/w/h 均为 0~1 的比例
    :return: [{name, image}, ...]
    """
    h, w = warped.shape[:2]
    crops = []
    for cell in cells:
        x1 = int(round(cell["x"] * w))
        y1 = int(round(cell["y"] * h))
        x2 = int(round((cell["x"] + cell["w"]) * w))
        y2 = int(round((cell["y"] + cell["h"]) * h))
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        crops.append({
            "name": cell["name"],
            "image": warped[y1:y2, x1:x2]
        })
    return crops
