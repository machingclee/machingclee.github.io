const n=`---
title: CV2, Pillow and shapely for Polygons
date: 2022-05-28
id: blog081
tag: python
intro: Record usual api for drawing apis in cv2, pillow and shapely.geometry.
---

### CV2

- Read image and correct channels
  \`\`\`python
  img = cv2.imread(img_path)
  img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
  img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
  \`\`\`
- Draw rectangle
  \`\`\`python
  cv2.rectangle(img, (x1, y1), (x2, y2), config.bbox_color, config.bbox_stroke)
  \`\`\`
- Write image into disk:
  \`\`\`python
  cv2.imwrite(img_path, img)
  \`\`\`
- Fill a polygon by coordinates:
  \`\`\`python
  # [[x1,y1], [x2,y2], ... ]
  points = np.array( [[[10,10],[100,10],[100,100],[10,100]]], dtype=np.int32 )
  img = np.zeros([240,320],dtype=np.uint8)
  cv2.fillPoly(img, pts=points, color=(0, 255, 0))
  \`\`\`

### Pillow

- Read image
  \`\`\`python
  from PIL import Image
  img = Image.open(img_path)
  \`\`\`
- Resize image
  \`\`\`python
  img = img.resize((new_width, new_height), Image.BILINEAR)
  \`\`\`
- Rotate image
  \`\`\`python
  img = img.rotate(angle, Image.BILINEAR) # in degree
  \`\`\`
- Get image height and width:
  \`\`\`python
  h, w = img.height, img.width
  \`\`\`
- Crop image:
  \`\`\`python
  box = (start_w, start_h, start_w + length, start_h + length)
  region = img.crop(box)
  \`\`\`
- Draw bounding box:

  \`\`\`python
  from PIL import ImageDraw

  draw = ImageDraw.Draw(img) # img: PIL.Image.Image
  for box in boxes:
    xmin, ymin, xmax, ymax = box
    draw.rectangle(((xmin, ymin), (xmax, ymax)), outline=(255,255,255,150), width=1)
  \`\`\`

### shapely.geometry.Polygon

To check intersection of two polygonal regions, we can:

\`\`\`python
from shapely.geometry import Polygon
poly1 = np.array([[x1, y1, x2, y2, x3, y3, x4, y4]])
poly2 = np.array([[x1_, y1_, x2_, y2_, x3_, y3_, x4_, y4_]])

p1 = Polygon(poly1).convex_hull
p2 = Polygon(poly2).convex_hull

inter_area = p1.intersection(p2).area
iou = inter_area / (p1.area + p2.area - inter_area)
\`\`\`
`;export{n as default};
