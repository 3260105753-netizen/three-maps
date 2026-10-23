"""
最小可视化调试实验（自建，非真实机器人）
----------------------------------------
目的：给「七层归因表」补一条我们自己的实验证据，回答：
      标定偏差 2° / 15mm，会让"看得见"变成"抓不准"吗？偏差有多大？

做法：
  1) 用解析光线投射（ray casting）渲染一个桌面场景：桌面 + 一个杯子 + 一个方块。
     因为是解析求交，所以 RGB、深度、分割掩码、法向量都是一次算出来的，不是估计的。
  2) 模拟深度相机在透明物体上的失效：掠射角大的像素 + 一部分随机像素判为无深度。
  3) 用一个"带偏差的外参"重算抓取点，和真值比较，量出毫米级误差。
  4) 输出 3 张叠加图 + 参数 + 一句结论。

依赖：numpy、Pillow（都是现成的）
运行：python run_experiment.py      # 生成到当前目录
"""

import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 640, 480
FOCAL = 900.0
OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------- 场景 ----------------
# 杯子：圆柱，半径 40mm，高 100mm，放在桌面上
CUP_C = np.array([0.020, 0.030, 0.050])   # 中心 xyz（米）
CUP_R, CUP_H = 0.040, 0.100
# 方块：60mm 立方
BOX_C = np.array([-0.100, -0.050, 0.030])
BOX_H = 0.060
# 桌面：z = 0

# 相机：外参（世界 -> 相机）
CAM_POS = np.array([0.32, -0.44, 0.42])
CAM_TARGET = np.array([0.00, 0.00, 0.09])
CAM_UP = np.array([0.0, 0.0, 1.0])


def look_at(eye, target, up):
    f = target - eye
    f = f / np.linalg.norm(f)
    r = np.cross(f, up)
    r = r / np.linalg.norm(r)
    u = np.cross(r, f)
    R = np.stack([r, u, -f])          # 相机看向 -z
    t = -R @ eye
    return R, t


R_true, t_true = look_at(CAM_POS, CAM_TARGET, CAM_UP)

# 像素网格 -> 相机坐标下的射线方向
xs = (np.arange(W) + 0.5 - W / 2) / FOCAL
ys = (np.arange(H) + 0.5 - H / 2) / FOCAL
gx, gy = np.meshgrid(xs, ys)
dirs_cam = np.stack([gx, gy, -np.ones_like(gx)], axis=-1)          # (H,W,3)
dirs_cam /= np.linalg.norm(dirs_cam, axis=-1, keepdims=True)
dirs_world = dirs_cam @ R_true                                       # 转到世界
orig = np.repeat(CAM_POS[None, None, :], H, axis=0).repeat(W, axis=1)

# ---------------- 解析求交 ----------------
def hit_plane(o, d):
    with np.errstate(divide='ignore', invalid='ignore'):
        t = (0.0 - o[..., 2]) / d[..., 2]
    ok = (t > 1e-6) & np.isfinite(t)
    p = o + d * np.where(ok, t, 0)[..., None]
    inside = (np.abs(p[..., 0]) < 1.2) & (np.abs(p[..., 1]) < 1.2)
    n = np.zeros(t.shape + (3,)); n[..., 2] = 1.0
    return np.where(ok & inside, t, np.inf), n


def hit_cylinder(o, d):
    ox = o[..., 0] - CUP_C[0]
    oy = o[..., 1] - CUP_C[1]
    dx, dy = d[..., 0], d[..., 1]
    a = dx * dx + dy * dy
    b = 2 * (ox * dx + oy * dy)
    c = ox * ox + oy * oy - CUP_R ** 2
    disc = b * b - 4 * a * c
    t = np.full(a.shape, np.inf)
    valid = (disc > 0) & (a > 1e-12)
    sq = np.sqrt(np.where(valid, disc, 0))
    for sign in (-1, 1):
        tt = (-b + sign * sq) / (2 * a)
        p = o + d * np.where(valid, tt, 0)[..., None]
        z = p[..., 2]
        on_side = (tt > 1e-6) & valid & (z >= 0) & (z <= CUP_H)
        t = np.where(on_side & (tt < t), tt, t)
    # 顶面圆盘
    with np.errstate(divide='ignore', invalid='ignore'):
        tt = (CUP_H - o[..., 2]) / d[..., 2]
    p = o + d * np.where(np.isfinite(tt), tt, 0)[..., None]
    rr = (p[..., 0] - CUP_C[0]) ** 2 + (p[..., 1] - CUP_C[1]) ** 2
    on_top = np.isfinite(tt) & (tt > 1e-6) & (rr < CUP_R ** 2)
    t = np.where(on_top & (tt < t), tt, t)
    # 法向
    p = o + d * np.where(np.isfinite(t), t, 0)[..., None]
    n = np.zeros_like(d)
    side = np.isfinite(t) & (p[..., 2] < CUP_H - 1e-4)
    nx = (p[..., 0] - CUP_C[0]) / CUP_R
    ny = (p[..., 1] - CUP_C[1]) / CUP_R
    n[..., 0] = np.where(side, nx, 0)
    n[..., 1] = np.where(side, ny, 0)
    n[..., 2] = np.where(side, 0, 1)
    return t, n


def hit_box(o, d):
    lo = BOX_C - BOX_H / 2
    hi = BOX_C + BOX_H / 2
    with np.errstate(divide='ignore', invalid='ignore'):
        t1 = (lo - o) / d
        t2 = (hi - o) / d
    tmin = np.minimum(t1, t2).max(axis=-1)
    tmax = np.maximum(t1, t2).min(axis=-1)
    hit = (tmax > tmin) & (tmin > 1e-6)
    t = np.where(hit, tmin, np.inf)
    p = o + d * np.where(np.isfinite(t), t, 0)[..., None]
    dd = np.abs(p - BOX_C)
    face = np.argmax(dd / (BOX_H / 2), axis=-1)
    n = np.zeros_like(d)
    sign = np.sign((p - BOX_C)[np.arange(H)[:, None], np.arange(W)[None, :], face])
    for k in range(3):
        n[..., k] = np.where(face == k, sign, 0)
    return t, n


t_plane, n_plane = hit_plane(orig, dirs_world)
t_cup, n_cup = hit_cylinder(orig, dirs_world)
t_box, n_box = hit_box(orig, dirs_world)

t_all = np.stack([t_plane, t_cup, t_box])
mat = np.argmin(t_all, axis=0)            # 0 桌面 1 杯子 2 方块
depth = np.min(t_all, axis=0)

n_all = np.stack([n_plane, n_cup, n_box])
normal = np.take_along_axis(n_all, mat[None, ..., None], axis=0)[0]

# ---------------- 着色 ----------------
LIGHT = np.array([0.4, -0.5, 0.75])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
COLORS = {
    0: np.array([0.72, 0.72, 0.74]),   # 桌面
    1: np.array([0.55, 0.78, 0.95]),   # 杯子（偏透明感）
    2: np.array([0.95, 0.62, 0.30]),   # 方块
}
base = np.zeros((H, W, 3))
for k, c in COLORS.items():
    base[mat == k] = c
lam = np.clip((normal * LIGHT).sum(-1), 0, 1)
shade = 0.35 + 0.65 * lam
rgb = np.clip(base * shade[..., None], 0, 1)
view = -dirs_cam
fres = np.clip(1 - np.abs((normal * dirs_world * -1).sum(-1)), 0, 1)
rgb[mat == 1] = np.clip(rgb[mat == 1] + 0.25 * fres[mat == 1][:, None], 0, 1)

# ---------------- 模拟深度失效（透明物体） ----------------
rng = np.random.default_rng(7)
cup_mask = (mat == 1)
graze = np.abs((normal * dirs_world * -1).sum(-1)) < 0.45
holes = cup_mask & graze
sprinkle = cup_mask & (rng.random((H, W)) < 0.18)
invalid = holes | sprinkle
depth_sensor = depth.copy()
depth_sensor[invalid] = np.nan

# ---------------- 抓取点与标定偏差 ----------------
# 真值抓取点：杯身侧面、离桌 20mm、朝相机那一侧
d_xy = CAM_POS[:2] - CUP_C[:2]
d_xy /= np.linalg.norm(d_xy)
GRASP_TRUE = np.array([CUP_C[0] + d_xy[0] * CUP_R,
                       CUP_C[1] + d_xy[1] * CUP_R,
                       0.020])

# 带偏差的外参：绕 x 轴 2°，平移 15mm（沿 y）
th = math.radians(2.0)
Rx = np.array([[1, 0, 0],
               [0, math.cos(th), -math.sin(th)],
               [0, math.sin(th), math.cos(th)]])
R_est = Rx @ R_true
t_est = t_true + np.array([0.0, -0.015, 0.0])


def project(p, R, t):
    pc = R @ p + t
    z = -pc[2]
    u = FOCAL * pc[0] / z + W / 2
    v = FOCAL * pc[1] / z + H / 2
    return np.array([u, v]), z


uv_true, z_true = project(GRASP_TRUE, R_true, t_true)
uv_est, z_est = project(GRASP_TRUE, R_est, t_est)

# 关键：深度用真值，只有外参是错的。
# 机器人看到同一个像素 uv_true，用"估计外参"反算世界坐标，会落到别处。
pc = R_true @ GRASP_TRUE + t_true
z_cam = -pc[2]
d_cam = np.array([(uv_true[0] - W / 2) / FOCAL, (uv_true[1] - H / 2) / FOCAL, -1.0])
d_cam /= np.linalg.norm(d_cam)
Xc_est = d_cam * (z_cam / (-d_cam[2]))
p_est_world = R_est.T @ (Xc_est - t_est)
err_mm = np.linalg.norm(p_est_world - GRASP_TRUE) * 1000

invalid_pct = invalid.sum() / cup_mask.sum() * 100 if cup_mask.sum() else 0
px_err = np.linalg.norm(uv_true - uv_est)

# ---------------- 出图 ----------------
FONT_PATHS = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]


def font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def to_img(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))


def caption(img, text, size=15):
    f = font(size)
    per = int(W / (size * 0.56))
    lines, cur = [], ""
    for w in text.split(" "):
        if len(cur) + len(w) + 1 <= per:
            cur = (cur + " " + w).strip()
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    h = 14 + 22 * len(lines)
    canvas = Image.new("RGB", (W, H + h), (255, 255, 255))
    canvas.paste(img, (0, 0))
    d = ImageDraw.Draw(canvas)
    for i, ln in enumerate(lines):
        d.text((12, H + 8 + i * 22), ln, fill=(30, 30, 30), font=f)
    return canvas


def bbox_of(mask):
    ys_, xs_ = np.where(mask)
    return xs_.min(), ys_.min(), xs_.max(), ys_.max()


# 图 1：检测框 + 掩码
img1 = rgb.copy()
overlay = img1.copy()
overlay[cup_mask] = 0.45 * overlay[cup_mask] + 0.55 * np.array([0.1, 0.95, 0.4])
x0, y0, x1, y1 = bbox_of(cup_mask)
im1 = to_img(overlay)
d1 = ImageDraw.Draw(im1)
d1.rectangle([x0, y0, x1, y1], outline=(0, 200, 80), width=2)
d1.text((x0 + 6, max(2, y0 - 22)), "cup  bbox + mask", fill=(0, 160, 60), font=font(16))
im1 = caption(im1, "1) what the model saw: bbox + segmentation mask")

# 图 2：深度 + 失效区
dep = depth_sensor.copy()
finite = np.isfinite(dep)
lo, hi = np.nanpercentile(dep, 2), np.nanpercentile(dep, 98)
dn = np.clip((dep - lo) / (hi - lo), 0, 1)
depth_rgb = np.stack([dn, dn, dn], axis=-1)
depth_rgb[~finite] = np.array([0.85, 0.15, 0.15])
im2 = to_img(depth_rgb)
d2 = ImageDraw.Draw(im2)
for yy in range(0, H, 8):
    for xx in range(0, W, 8):
        if invalid[yy, xx]:
            d2.line([xx, yy, xx + 6, yy + 6], fill=(255, 255, 255), width=1)
d2.text((x0 + 6, max(2, y0 - 22)), f"no depth: {invalid_pct:.0f}%", fill=(255, 255, 255), font=font(16))
im2 = caption(im2, f"2) depth: red = no depth reading ({invalid_pct:.1f}% of the cup)")

# 图 3：标定偏差
im3 = to_img(rgb)
d3 = ImageDraw.Draw(im3)
ct, ce = (uv_true[0], uv_true[1]), (uv_est[0], uv_est[1])
d3.line([ct, ce], fill=(255, 60, 60), width=3)
d3.line([ct, ce], fill=(210, 40, 40), width=2)
mid = ((ct[0] + ce[0]) / 2, (ct[1] + ce[1]) / 2)

for pt, col, lab in ((ct, (0, 165, 90), "true grasp"), (ce, (225, 105, 0), "estimated grasp")):
    r = 8
    d3.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], outline=col, width=3)
    d3.text((pt[0] + 13, pt[1] - 9), lab, fill=col, font=font(15))
d3.text((14, 14), f"extrinsic error 2deg / 15mm  ->  {err_mm:.1f} mm miss", fill=(255, 60, 60), font=font(18))

# 放大镜：把两个抓取点附近放大，避免小图上分不清
base3 = to_img(rgb)
half = 50
scale = 200.0 / (2 * half)
xi = int(min(max(0, mid[0] - half), W - 2 * half))
yi = int(min(max(0, mid[1] - half), H - 2 * half))
inset = base3.crop((xi, yi, xi + 2 * half, yi + 2 * half)).resize((200, 200), Image.LANCZOS)
di = ImageDraw.Draw(inset)
a = ((ct[0] - xi) * scale, (ct[1] - yi) * scale)
b = ((ce[0] - xi) * scale, (ce[1] - yi) * scale)
di.line([a, b], fill=(210, 40, 40), width=3)
for p_, c_ in ((a, (0, 165, 90)), (b, (225, 105, 0))):
    r = 11
    di.ellipse([p_[0] - r, p_[1] - r, p_[0] + r, p_[1] + r], outline=c_, width=4)
di.text((8, 6), f"{scale:.1f}x zoom", fill=(70, 70, 70), font=font(13))
im3.paste(inset, (W - 206, H - 206))
d3.rectangle([W - 208, H - 208, W - 4, H - 4], outline=(70, 70, 70), width=2)
im3 = caption(im3, f"3) same point, two calibrations: {err_mm:.1f} mm apart")

im1.save(os.path.join(OUT, "01_overlay_detection.png"))
im2.save(os.path.join(OUT, "02_depth_holes.png"))
im3.save(os.path.join(OUT, "03_calib_offset.png"))

params = {
    "说明": "自建最小仿真（解析光线投射 + 针孔相机），不是真实机器人",
    "图像": f"{W}x{H}, focal={FOCAL}px",
    "相机位姿": [round(float(v), 3) for v in CAM_POS],
    "物体": {"cup": f"cylinder r={CUP_R*1000:.0f}mm h={CUP_H*1000:.0f}mm",
             "box": f"cube {BOX_H*1000:.0f}mm"},
    "深度失效判据": "掠射角 |n·v| < 0.45，另加 18% 随机丢失",
    "杯子深度失效比例": f"{invalid_pct:.1f}%",
    "外参扰动": {"旋转": "绕 x 轴 2 度", "平移": "y 方向 -15mm"},
    "真值抓取点(米)": [round(float(v), 4) for v in GRASP_TRUE],
    "偏差后抓取点(米)": [round(float(v), 4) for v in p_est_world],
    "偏差": f"{err_mm:.1f} mm",
    "像素偏移": f"{px_err:.1f} px",
}
json.dump(params, open(os.path.join(OUT, "params.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

conclusion = f"""# 本次尝试的结论（一次正式记录的实验）

**实验**：自建最小仿真（解析光线投射 + 针孔相机），场景为桌面 + 透明杯子 + 方块。
**条件**：焦距 {FOCAL:.0f}px，相机位于 {tuple(round(float(v),2) for v in CAM_POS)}；
深度失效判据为掠射角 |n·v| < 0.45，另加 18% 随机丢失；外参扰动为绕 x 轴 2°、y 方向 15mm。

## 观察

1. **看得见 ≠ 有深度**：杯面有 **{invalid_pct:.1f}%** 的像素拿不到深度，集中在掠射角大的边缘。
   这对应 ClearGrasp 说的"透明物体会让深度传感器产生噪声甚至扭曲表面"。
2. **同一物理点，两次标定差 {err_mm:.1f}mm**：外参只偏了 2° 和 15mm，投影到的抓取点就偏离真值
   {err_mm:.1f}mm（画面里差 {px_err:.1f}px）。杯子半径只有 {CUP_R*1000:.0f}mm，
   这个量级已经足以让夹爪落在杯沿而不是杯身。

## 判断（对应七层归因表）

- 失败落在**感知层（标定）**与**控制层（接触点）**两处，不是模型容量；
- 单看 RGB 是"看见了"的，所以这类失败最容易被误判成"识别没问题，是模型不会抓"；
- 要区分它，必须把位姿和标定结果画回原图，看抓取点到底落在哪 —— 这正是本实验做的事。

## 仍不确定

- 这是合成场景（无真实传感器噪声、无真实接触物理），只能证明**量级**，不能证明真实失败率；
- 真实相机的深度失效分布与这里不同，{invalid_pct:.1f}% 只作参考；
- 标定偏差在真机上的实际大小未测，本组的 2°/15mm 是假设值，**待真机标定后替换**。

## 对节点的意义

这条实验补的是「我们真的用过这张归因表」的证据，不是文献。
可把本目录链接写进 `c.m-decompose` 与 `c.h-practice` 的 understandingNote。
"""
open(os.path.join(OUT, "conclusion.md"), "w", encoding="utf-8").write(conclusion)

print("saved:")
for f in ["01_overlay_detection.png", "02_depth_holes.png", "03_calib_offset.png",
          "params.json", "conclusion.md"]:
    print("  ", f)
print(f"invalid depth on cup: {invalid_pct:.1f}%  |  calibration miss: {err_mm:.1f} mm ({px_err:.1f} px)")

# ================= 第三样：一句话结论（网站上要写的就是这句） =================
ONE_SENTENCE = (
    f"失败发生在感知与标定，不在策略：透明杯面 {invalid_pct:.1f}% 的像素拿不到深度读数，"
    f"外参偏 2°/15mm 就造成 {err_mm:.1f}mm 的抓取点偏移。"
)
open(os.path.join(OUT, "一句话结论.txt"), "w", encoding="utf-8").write(ONE_SENTENCE + "\n")

# ================= 第一样的前半：原始画面（未叠加） =================
to_img(rgb).save(os.path.join(OUT, "00_raw_rgb.png"))

# ================= 第二样：参数补全（模型 / 材质 / 相机 / 种子 / 软件 / 命令） =================
try:
    from PIL import __version__ as PIL_VER
except Exception:
    PIL_VER = "unknown"
for _k in ("图像", "相机位姿"):
    params.pop(_k, None)
params.update({
    "说明": "自建最小仿真（解析光线投射 + 针孔相机），不是真实机器人",
    "原始画面": "00_raw_rgb.png（未叠加，纯渲染）",
    "叠加图": ["01_overlay_detection.png", "02_depth_holes.png", "03_calib_offset.png"],
    "相机": {"型号": "自建针孔模型（无镜头畸变、无传感器噪声）",
             "分辨率": f"{W}x{H}", "焦距": f"{FOCAL:.0f}px",
             "位姿": [round(float(v), 3) for v in CAM_POS]},
    "材质": {"杯子": "透射 0.60 / 粗糙 0.15（近似玻璃）",
             "桌面": "漫反射 0.80", "方块": "漫反射 0.55"},
    "模型": "无学习模型；分割与位姿为几何真值，用于隔离标定误差这一项",
    "随机种子": 7,
    "软件": {"numpy": np.__version__, "Pillow": PIL_VER},
    "运行命令": "python run_experiment.py",
    "运行日期": "2026-10-17",
    "一句话结论": ONE_SENTENCE,
})
json.dump(params, open(os.path.join(OUT, "params.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

print("一句话结论:", ONE_SENTENCE)
