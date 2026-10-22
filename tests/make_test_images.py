# Generate small, feature-rich JPEG test images for carousel upload tests
from PIL import Image, ImageDraw
import random, os

os.makedirs("/tmp/carousel_imgs", exist_ok=True)
colors = [(200, 80, 60), (60, 140, 200), (80, 180, 90), (220, 180, 40)]
for i, base in enumerate(colors):
    random.seed(i)
    img = Image.new("RGB", (600, 600), base)
    d = ImageDraw.Draw(img)
    for _ in range(40):
        x, y = random.randint(0, 560), random.randint(0, 560)
        w, h = random.randint(20, 160), random.randint(20, 160)
        c = tuple(random.randint(0, 255) for _ in range(3))
        if random.random() > 0.5:
            d.rectangle([x, y, x + w, y + h], fill=c, outline=(0, 0, 0), width=3)
        else:
            d.ellipse([x, y, x + w, y + h], fill=c, outline=(255, 255, 255), width=3)
    d.text((20, 20), f"TEST IMAGE {i + 1}", fill=(255, 255, 255))
    img.save(f"/tmp/carousel_imgs/photo{i + 1}.jpg", "JPEG", quality=85)
print("ok", os.listdir("/tmp/carousel_imgs"))
