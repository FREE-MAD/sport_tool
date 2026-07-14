import time, sys, os
from pathlib import Path

# 创建标记文件表示进程已开始
Path("_bg_test_started.txt").write_text(str(time.time()), encoding="utf-8")

# 睡眠12秒
for i in range(12):
    time.sleep(1)

# 创建标记文件表示进程已完成
Path("_bg_test_done.txt").write_text(str(time.time()), encoding="utf-8")
