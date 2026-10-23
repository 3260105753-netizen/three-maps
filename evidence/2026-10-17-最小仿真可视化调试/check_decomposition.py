import numpy as np, math

# 复刻实验里的几何，把 16.2mm 拆开看是谁贡献的
CAM_POS = np.array([0.32, -0.44, 0.42])
CAM_TARGET = np.array([0.00, 0.00, 0.09])
UP = np.array([0, 0, 1.0])
FOCAL, W, H = 900.0, 640, 480
CUP_C = np.array([0.020, 0.030, 0.050]); CUP_R = 0.040
GRASP = np.array([0.0415, -0.0037, 0.020])   # 来自 params.json 的真值点


def look_at(eye, target, up):
    f = target - eye; f = f / np.linalg.norm(f)
    r = np.cross(f, up); r = r / np.linalg.norm(r)
    u = np.cross(r, f)
    return np.stack([r, u, -f]), -np.stack([r, u, -f]) @ eye


R, t = look_at(CAM_POS, CAM_TARGET, UP)
th = math.radians(2.0)
Rx = np.array([[1, 0, 0], [0, math.cos(th), -math.sin(th)], [0, math.sin(th), math.cos(th)]])
R_rot = Rx @ R
t_rot = t
R_tr = R
t_tr = t + np.array([0.0, -0.015, 0.0])
R_both, t_both = R_rot, t_tr


def project(p, R_, t_):
    pc = R_ @ p + t_
    z = -pc[2]
    return np.array([FOCAL * pc[0] / z + W / 2, FOCAL * pc[1] / z + H / 2]), z


def estimate(uv, z, R_, t_):
    d = np.array([(uv[0] - W / 2) / FOCAL, (uv[1] - H / 2) / FOCAL, -1.0])
    d /= np.linalg.norm(d)
    Xc = d * (z / (-d[2]))
    return R_.T @ (Xc - t_)


uv, z = project(GRASP, R, t)
print(f"相机到抓取点深度 z = {z*1000:.0f} mm")

for name, R_, t_ in [("只偏旋转 2°", R_rot, t_rot),
                     ("只偏平移 15mm", R_tr, t_tr),
                     ("两者都有", R_both, t_both)]:
    p = estimate(uv, z, R_, t_)
    err = np.linalg.norm(p - GRASP) * 1000
    print(f"{name:12s} -> 抓取点偏差 {err:6.1f} mm   分量 dx={1000*(p[0]-GRASP[0]):6.1f} dy={1000*(p[1]-GRASP[1]):6.1f} dz={1000*(p[2]-GRASP[2]):6.1f}")

print()
print("名义误差估算（角度随距离线性放大）:")
for d in (0.040, 0.100, 0.657):
    print(f"  距离 {d*1000:5.0f} mm 处，2° = {d*math.radians(2)*1000:5.1f} mm")
