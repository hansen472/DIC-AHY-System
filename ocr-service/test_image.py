import cv2
import numpy as np

# 创建一张模拟表格图片：A4 比例，四角明显
h, w = 800, 600
img = np.ones((h, w, 3), dtype=np.uint8) * 255

# 绘制表格外框（粗黑线）
cv2.rectangle(img, (40, 40), (w-40, h-40), (0, 0, 0), 4)

# 绘制几条横竖线形成单元格
cv2.line(img, (40, 150), (w-40, 150), (0, 0, 0), 2)
cv2.line(img, (40, 260), (w-40, 260), (0, 0, 0), 2)
cv2.line(img, (40, 370), (w-40, 370), (0, 0, 0), 2)
cv2.line(img, (300, 150), (300, 260), (0, 0, 0), 2)

# 写一些简单文字（打印体，OCR 应能识别）
font = cv2.FONT_HERSHEY_SIMPLEX
cv2.putText(img, "Company: Aptar", (60, 110), font, 1, (0, 0, 0), 2, cv2.LINE_AA)
cv2.putText(img, "Product: Pump", (60, 220), font, 1, (0, 0, 0), 2, cv2.LINE_AA)
cv2.putText(img, "Model: X100", (320, 220), font, 1, (0, 0, 0), 2, cv2.LINE_AA)
cv2.putText(img, "Qty: 100", (60, 330), font, 1, (0, 0, 0), 2, cv2.LINE_AA)
cv2.putText(img, "2026-07-22", (320, 330), font, 1, (0, 0, 0), 2, cv2.LINE_AA)

cv2.imwrite("C:/Users/Administrator/Desktop/xiugaiqian/ocr-service/test_table.jpg", img)
print("test_table.jpg generated")
