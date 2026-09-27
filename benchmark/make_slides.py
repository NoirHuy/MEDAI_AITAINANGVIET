import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

def create_deck(filename="benchmark/slides_bao_cao.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Colors
    c_title = RGBColor(16, 44, 87)       # Navy
    c_blue = RGBColor(26, 115, 232)      # Primary Blue
    c_teal = RGBColor(13, 148, 136)      # Teal
    c_orange = RGBColor(234, 112, 16)    # Orange
    c_green = RGBColor(16, 149, 78)      # Green
    c_dark = RGBColor(30, 41, 59)        # Body text

    def add_header(slide, title_text):
        tx_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.8))
        tf = tx_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(32)
        p.font.bold = True
        p.font.color.rgb = c_title
        p.font.name = "Segoe UI"

    # =========================================================================
    # SLIDE 1: Bộ dữ liệu thực nghiệm (GIỮ NGUYÊN BẢN ĐẦY ĐỦ NHƯ CŨ)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    add_header(s1, "Bộ dữ liệu thực nghiệm")

    # Card 1 (Left - Blue)
    card1 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.3), Inches(5.6), Inches(5.6))
    card1.fill.solid()
    card1.fill.fore_color.rgb = RGBColor(255, 255, 255)
    card1.line.color.rgb = c_blue
    card1.line.width = Pt(2.5)

    tf1 = card1.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "Nguồn dữ liệu"
    p1.font.size = Pt(24)
    p1.font.bold = True
    p1.font.color.rgb = c_blue
    p1.font.name = "Segoe UI"
    p1.space_after = Pt(14)

    bullets1 = [
        "Bộ dữ liệu chuẩn quốc tế DDXPlus Benchmark từ Viện Nghiên cứu Trí tuệ Nhân tạo Montreal (MILA — NeurIPS).",
        "Bộ test gồm 100 ca bệnh lâm sàng chuẩn hóa bao phủ 9 chuyên khoa y tế chính.",
        "Mỗi ca bệnh gồm lý do đến khám ban đầu (Chief Complaint), bệnh sử, triệu chứng dương tính/âm tính và bệnh lý chuẩn làm nhãn.",
        "Dữ liệu dùng để kiểm tra khả năng hỏi bệnh tương tác đa vòng và chẩn đoán phân biệt (DDx)."
    ]
    for b in bullets1:
        p = tf1.add_paragraph()
        p.text = "•  " + b
        p.font.size = Pt(15.5)
        p.font.color.rgb = c_dark
        p.font.name = "Segoe UI"
        p.space_after = Pt(12)

    # Card 2 (Right - Teal)
    card2 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(1.3), Inches(5.6), Inches(5.6))
    card2.fill.solid()
    card2.fill.fore_color.rgb = RGBColor(255, 255, 255)
    card2.line.color.rgb = c_teal
    card2.line.width = Pt(2.5)

    tf2 = card2.text_frame
    tf2.word_wrap = True
    p2 = tf2.paragraphs[0]
    p2.text = "Vì sao phù hợp?"
    p2.font.size = Pt(24)
    p2.font.bold = True
    p2.font.color.rgb = c_teal
    p2.font.name = "Segoe UI"
    p2.space_after = Pt(14)

    bullets2 = [
        "Là bộ dữ liệu chuẩn quốc tế độc lập, loại bỏ hoàn toàn thiên lệch dữ liệu và đảm bảo so sánh công bằng giữa các mô hình.",
        "Mô phỏng chính xác quy trình hỏi bệnh lâm sàng từng bước (bắt đầu từ 1 triệu chứng ban đầu, qua 3 vòng hỏi để bóc tách triệu chứng ẩn).",
        "Có ontology triệu chứng chuẩn hóa (49 triệu chứng), giúp đánh giá khách quan năng lực khai thác thông tin của mô hình AI."
    ]
    for b in bullets2:
        p = tf2.add_paragraph()
        p.text = "•  " + b
        p.font.size = Pt(15.5)
        p.font.color.rgb = c_dark
        p.font.name = "Segoe UI"
        p.space_after = Pt(14)

    # =========================================================================
    # SLIDE 2: Chỉ số đánh giá
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Chỉ số đánh giá")

    card2_1 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.3), Inches(5.6), Inches(5.6))
    card2_1.fill.solid()
    card2_1.fill.fore_color.rgb = RGBColor(255, 255, 255)
    card2_1.line.color.rgb = c_blue
    card2_1.line.width = Pt(2.5)

    tf2_1 = card2_1.text_frame
    tf2_1.word_wrap = True
    p = tf2_1.paragraphs[0]
    p.text = "1. Tỷ lệ trúng Top 5"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = c_blue
    p.font.name = "Segoe UI"
    p.space_after = Pt(14)

    p_desc = tf2_1.add_paragraph()
    p_desc.text = "Đo tỷ lệ ca bệnh mà chẩn đoán đúng nằm trong Top 5 bệnh nghi ngờ do hệ thống đề xuất sau 3 vòng hỏi."
    p_desc.font.size = Pt(17)
    p_desc.font.color.rgb = c_dark
    p_desc.font.name = "Segoe UI"
    p_desc.space_after = Pt(14)

    b_items1 = [
        "Đánh giá độ an toàn trong khâu sàng lọc và phân luồng bệnh nhân.",
        "Ngăn ngừa nguy cơ bỏ sót các bệnh lý nguy hiểm."
    ]
    for bi in b_items1:
        p = tf2_1.add_paragraph()
        p.text = "•  " + bi
        p.font.size = Pt(16.5)
        p.font.color.rgb = c_dark
        p.space_after = Pt(12)

    p_formula = tf2_1.add_paragraph()
    p_formula.text = "Hit Rate @ 5 = (Số ca đúng ∈ Top 5) / (Tổng số ca)"
    p_formula.font.size = Pt(15.5)
    p_formula.font.bold = True
    p_formula.font.color.rgb = c_blue
    p_formula.space_before = Pt(8)

    card2_2 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(1.3), Inches(5.6), Inches(5.6))
    card2_2.fill.solid()
    card2_2.fill.fore_color.rgb = RGBColor(255, 255, 255)
    card2_2.line.color.rgb = c_orange
    card2_2.line.width = Pt(2.5)

    tf2_2 = card2_2.text_frame
    tf2_2.word_wrap = True
    p = tf2_2.paragraphs[0]
    p.text = "2. Hỏi trúng triệu chứng ẩn"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = c_orange
    p.font.name = "Segoe UI"
    p.space_after = Pt(14)

    p_desc2 = tf2_2.add_paragraph()
    p_desc2.text = "Tỷ lệ câu hỏi được người bệnh xác nhận là \"CÓ\" (trúng triệu chứng người bệnh có nhưng chưa khai ban đầu)."
    p_desc2.font.size = Pt(17)
    p_desc2.font.color.rgb = c_dark
    p_desc2.font.name = "Segoe UI"
    p_desc2.space_after = Pt(14)

    b_items2 = [
        "Đo lường độ nhạy bén và năng lực khai thác bệnh sử lâm sàng.",
        "Tránh các câu hỏi lan man mà người bệnh phủ nhận.",
        "Tối ưu qua Information Gain: ClinicalUtility(S) = σ(P) × √(avg(P))"
    ]
    for bi in b_items2:
        p = tf2_2.add_paragraph()
        p.text = "•  " + bi
        p.font.size = Pt(16.5)
        p.font.color.rgb = c_dark
        p.space_after = Pt(12)

    # =========================================================================
    # SLIDE 3: Kết quả đánh giá
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Kết quả đánh giá tổng hợp")

    rows = 4
    cols = 4
    left = Inches(0.8)
    top = Inches(1.3)
    width = Inches(11.7)
    height = Inches(2.8)

    table_shape = s3.shapes.add_table(rows, cols, left, top, width, height)
    tbl = table_shape.table

    tbl.columns[0].width = Inches(3.6)
    tbl.columns[1].width = Inches(2.5)
    tbl.columns[2].width = Inches(2.7)
    tbl.columns[3].width = Inches(2.9)

    headers = ["Mô hình", "Tỷ lệ trúng Top 5", "Hỏi trúng triệu chứng ẩn", "Diễn giải"]
    for j, h in enumerate(headers):
        cell = tbl.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(16, 44, 87)
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)
        p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

    data = [
        ["Hệ thống đề xuất (MedAI)", "90,0%", "35,0%", "Độ chính xác và độ nhạy dẫn đầu"],
        ["Gemini 3.1 Flash Lite", "85,0%", "11,7%", "Độ chính xác tốt"],
        ["GPT-OSS-120B", "85,0%", "20,0%", "Độ chính xác tốt"]
    ]

    for i, row in enumerate(data):
        for j, val in enumerate(row):
            cell = tbl.cell(i + 1, j)
            cell.fill.solid()
            if i == 0:
                cell.fill.fore_color.rgb = RGBColor(238, 246, 255)
            else:
                cell.fill.fore_color.rgb = RGBColor(255, 255, 255) if i % 2 == 1 else RGBColor(248, 250, 252)
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(17)
            p.font.name = "Segoe UI"
            if i == 0:
                p.font.bold = True
                p.font.color.rgb = c_blue if j < 3 else c_title
            else:
                p.font.color.rgb = c_dark
            p.alignment = PP_ALIGN.CENTER if (0 < j < 3) else PP_ALIGN.LEFT

    nx_box = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.5), Inches(11.7), Inches(2.3))
    nx_box.fill.solid()
    nx_box.fill.fore_color.rgb = RGBColor(255, 255, 255)
    nx_box.line.color.rgb = c_green
    nx_box.line.width = Pt(2.0)

    nx_tf = nx_box.text_frame
    nx_tf.word_wrap = True
    nx_p1 = nx_tf.paragraphs[0]
    nx_p1.text = "Nhận xét"
    nx_p1.font.size = Pt(20)
    nx_p1.font.bold = True
    nx_p1.font.color.rgb = c_green
    nx_p1.space_after = Pt(8)

    p_nx = nx_tf.add_paragraph()
    p_nx.text = "Hệ thống đề xuất (MedAI) đạt 90,0% ở Top 5 và độ nhạy hỏi trúng triệu chứng ẩn 35,0%, cao nhất trong bảng; cho thấy khả năng thu thập thông tin và định hướng chẩn đoán vượt trội."
    p_nx.font.size = Pt(17.5)
    p_nx.font.color.rgb = c_dark
    p_nx.font.name = "Segoe UI"

    # =========================================================================
    # SLIDE 4: Kết luận
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Kết luận")

    card4 = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(1.3), Inches(11.3), Inches(5.6))
    card4.fill.solid()
    card4.fill.fore_color.rgb = RGBColor(255, 255, 255)
    card4.line.color.rgb = c_blue
    card4.line.width = Pt(2.5)

    tf4 = card4.text_frame
    tf4.word_wrap = True
    p4 = tf4.paragraphs[0]
    p4.text = "Kết quả chính"
    p4.font.size = Pt(26)
    p4.font.bold = True
    p4.font.color.rgb = c_blue
    p4.space_after = Pt(20)

    bullets4 = [
        "Hoàn thiện hệ thống khám bệnh tương tác đa vòng dựa trên Đồ thị tri thức SymCAT và thuật toán Bayesian Scoring.",
        "Tỷ lệ trúng Top 5 đạt 90,0%, cao hơn các mô hình ngôn ngữ lớn (Gemini 85,0%, GPT-120B 85,0%).",
        "Độ nhạy hỏi trúng triệu chứng ẩn đạt 35,0%, cao gấp 1,75x – 3,0x so với các mô hình đối chiếu.",
        "Hướng phát triển: Mở rộng đồ thị tri thức, tích hợp Computer Vision cho Da Liễu và xét nghiệm cận lâm sàng."
    ]
    for b in bullets4:
        p = tf4.add_paragraph()
        p.text = "•  " + b
        p.font.size = Pt(19)
        p.font.color.rgb = c_dark
        p.space_after = Pt(20)

    prs.save(filename)
    prs.save("benchmark/BenchMark.pptx")
    print(f"Presentation regenerated successfully: {filename} and benchmark/BenchMark.pptx")

if __name__ == "__main__":
    create_deck()
