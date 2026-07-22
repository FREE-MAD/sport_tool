"""Count scoring points from scanned PDF tables using image analysis."""
import fitz, os, numpy as np, re
from PIL import Image, ImageStat
import io

BASE = r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南\按目录切分_1-88\按节'

def render_page_to_array(doc, page_idx, dpi=150):
    """Render a PDF page to grayscale numpy array."""
    page = doc[page_idx]
    mat = fitz.Matrix(dpi/72, dpi/72)
    pix = page.get_pixmap(matrix=mat)
    img_data = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_data)).convert('L')
    return np.array(img)

def detect_table_rows(img_arr, min_row_height=8, max_row_height=50):
    """Detect table data rows by analyzing horizontal brightness patterns."""
    h, w = img_arr.shape
    row_means = img_arr.mean(axis=1).astype(float)

    # Normalize: find the typical white level
    white_level = np.percentile(row_means, 95)
    dark_threshold = white_level * 0.85

    # Find dark rows (containing text)
    is_dark = row_means < dark_threshold

    # Smooth: expand dark regions slightly to close gaps
    from scipy.ndimage import binary_closing, binary_opening
    # Simple manual smoothing
    kernel = 2
    smoothed = np.copy(is_dark)
    for _ in range(kernel):
        smoothed[:-1] = smoothed[:-1] | is_dark[1:]
        smoothed[1:] = smoothed[1:] | is_dark[:-1]

    # Find contiguous dark segments (table rows)
    changes = np.diff(np.concatenate([[False], smoothed, [False]]).astype(int))
    starts = np.where(changes == 1)[0]
    ends = np.where(changes == -1)[0]

    # Filter by height
    rows = []
    for s, e in zip(starts, ends):
        height = e - s
        if min_row_height <= height <= max_row_height:
            rows.append((s, e, height))

    return rows

def count_pairs_per_row(img_arr, row_y_range, is_track_event, dpi=150):
    """Count how many score-value pairs are in a sample data row.
    For track events: 7 pairs (14 numbers per row). 
    For field events: 3 pairs (6 numbers per row).
    For swimming: varies (need to detect).
    """
    s, e = row_y_range
    row_strip = img_arr[s:e, :]

    # Detect columns by vertical projection
    col_means = row_strip.mean(axis=0)
    white_level = np.percentile(col_means, 90)
    dark_threshold = white_level * 0.8

    is_dark_col = col_means < dark_threshold

    # Find dark column segments
    changes = np.diff(np.concatenate([[False], is_dark_col, [False]]).astype(int))
    col_starts = np.where(changes == 1)[0]
    col_ends = np.where(changes == -1)[0]

    # Filter valid width columns
    min_col_width = int(dpi * 0.25)  # at least ~0.25 inch
    max_col_width = int(dpi * 1.5)
    columns = [(cs, ce) for cs, ce in zip(col_starts, col_ends)
               if min_col_width <= ce - cs <= max_col_width]

    # Each column typically represents 1 value
    # So pairs = columns // 2 (but we need to account for the fact that 
    # some events have value+score as one column block)
    # Actually, simpler: detect pairs by looking at structure
    return len(columns)

def is_table_page(img_arr):
    """Quick check if this page contains a scoring table."""
    h, w = img_arr.shape
    # Take a sample from middle of page
    sample = img_arr[h//4:3*h//4, w//4:3*w//4]
    # If too bright (empty), skip
    if np.mean(sample) > 250:
        return False
    return True

# Test with 100m running
print("=" * 60)
print("TEST: 100m run (7 pages)")
print("=" * 60)

path = os.path.join(BASE, '02-01_第二章_第一节_100米跑_印刷页002-008.pdf')
doc = fitz.open(path)
print(f"Total pages: {len(doc)}")

total_pairs = 0
for page_idx in range(len(doc)):
    arr = render_page_to_array(doc, page_idx, dpi=150)
    if not is_table_page(arr):
        print(f"  Page {page_idx+1}: SKIP (not a table page)")
        continue

    rows = detect_table_rows(arr)
    if not rows:
        print(f"  Page {page_idx+1}: NO ROWS DETECTED")
        # Print row_means distribution for debugging
        row_means = arr.mean(axis=1)
        print(f"    white_level={np.percentile(row_means, 95):.0f}")
        print(f"    min={row_means.min():.0f} max={row_means.max():.0f}")
        continue

    # Try to determine pairs per row from a sample row
    sample_row = rows[len(rows)//2]  # middle row
    pairs_per_row = count_pairs_per_row(arr, (sample_row[0], sample_row[1]), True)

    # Remove header rows (usually first 2-3 rows)
    data_rows = rows[3:] if len(rows) > 3 else rows[:1]
    page_pairs = len(data_rows) * pairs_per_row if pairs_per_row > 0 else len(data_rows) * 7  # default 7 for track

    print(f"  Page {page_idx+1}: {len(rows)} total rows, {len(data_rows)} data rows, "
          f"{pairs_per_row} pairs/row => ~{page_pairs} points")
    total_pairs += page_pairs

doc.close()
print(f"\nTOTAL (100m): ~{total_pairs} scoring points")
