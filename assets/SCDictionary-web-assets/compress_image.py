
from PIL import Image
import os
import shutil

for image_name in os.listdir(r"C:\Users\user\OneDrive\Documents\SCDictionary\SCDictionary-web-assets\screenshots"):
    if image_name.endswith(".jpg"):
        print("processing", image_name)
        pic = Image.open(os.path.join(r"C:\Users\user\OneDrive\Documents\SCDictionary\SCDictionary-web-assets\screenshots", image_name)).convert('RGB')

        temp_img_dir = os.path.abspath(os.path.join(r"C:\Users\user\OneDrive\Documents\SCDictionary\SCDictionary-web-assets\screenshots", "..", "_screenshots"))
        thumbs_dir = os.path.abspath(os.path.join(r"C:\Users\user\OneDrive\Documents\SCDictionary\SCDictionary-web-assets\screenshots", "..", "thumbs"))

        if not os.path.exists(temp_img_dir):
            os.makedirs(temp_img_dir)
        if not os.path.exists(thumbs_dir):
            os.makedirs(thumbs_dir)

        # for compressed images
        tar_image_path = os.path.abspath(os.path.join(temp_img_dir, image_name))
        tar_thumb_path = os.path.abspath(os.path.join(thumbs_dir, image_name))

        pic.save(tar_image_path, optimize=True, quality=60)
        width, height = pic.size
        pic_thumb = pic.resize((int(0.3 * width), int(0.3 * height)))
        pic_thumb.save(tar_thumb_path, optimize=True, quality=60)

        print(tar_image_path, "saved")

shutil.rmtree(r"C:\Users\user\OneDrive\Documents\SCDictionary\SCDictionary-web-assets\screenshots")
os.rename(temp_img_dir, r"C:\Users\user\OneDrive\Documents\SCDictionary\SCDictionary-web-assets\screenshots")
  