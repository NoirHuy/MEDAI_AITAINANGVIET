# 📑 NỘI DUNG 4 SLIDE TRÌNH BÀY (DÙNG ĐỂ COPY & DÁN VÀO BÁO CÁO)

---

## 📌 SLIDE 1: BỘ DỮ LIỆU THỰC NGHIỆM

# Bộ dữ liệu thực nghiệm

### 🟦 Khung Trái: **Nguồn dữ liệu**
* Bộ dữ liệu chuẩn quốc tế **DDXPlus Benchmark** từ Viện Nghiên cứu Trí tuệ Nhân tạo Montreal (**MILA** — NeurIPS).
* Bộ test gồm **100 ca bệnh lâm sàng chuẩn hóa** bao phủ **9 chuyên khoa** y tế chính.
* Mỗi ca bệnh gồm lý do đến khám ban đầu (Chief Complaint), bệnh sử, triệu chứng dương tính/âm tính và bệnh lý chuẩn làm nhãn.
* Dữ liệu dùng để kiểm tra khả năng hỏi bệnh tương tác đa vòng và chẩn đoán phân biệt (DDx).

### 🟩 Khung Phải: **Vì sao phù hợp?**
* Là bộ dữ liệu chuẩn quốc tế độc lập, loại bỏ hoàn toàn thiên lệch dữ liệu và đảm bảo so sánh công bằng giữa các mô hình.
* Mô phỏng chính xác quy trình hỏi bệnh lâm sàng từng bước (bắt đầu từ 1 triệu chứng ban đầu, qua 3 vòng hỏi để bóc tách triệu chứng ẩn).
* Có ontology triệu chứng chuẩn hóa (49 triệu chứng), giúp đánh giá khách quan năng lực khai thác thông tin của mô hình AI.

---

## 📌 SLIDE 2: CHỈ SỐ ĐÁNH GIÁ

# Chỉ số đánh giá

### 🟦 Khung Trái: **1. Tỷ lệ trúng Top 5**
Đo tỷ lệ ca bệnh mà chẩn đoán đúng nằm trong Top 5 bệnh nghi ngờ do hệ thống đề xuất sau 3 vòng hỏi.
* Đánh giá độ an toàn trong khâu sàng lọc và phân luồng bệnh nhân.
* Ngăn ngừa nguy cơ bỏ sót các bệnh lý nguy hiểm.

$$\text{Hit Rate @ 5} = \frac{\sum_{i=1}^{N} \mathbb{I}(\text{GroundTruth}_i \in \text{Top5}_i)}{N}$$

### 🟧 Khung Phải: **2. Hỏi trúng triệu chứng ẩn**
Tỷ lệ câu hỏi được người bệnh xác nhận là **"CÓ"** (trúng triệu chứng người bệnh có nhưng chưa khai ban đầu).
* Đo lường độ nhạy bén và năng lực khai thác bệnh sử lâm sàng.
* Tránh các câu hỏi lan man mà người bệnh phủ nhận.
* Tối ưu qua Information Gain:
$$\text{ClinicalUtility}(S) = \sigma(P) \times \sqrt{\bar{P}}$$

---

## 📌 SLIDE 3: KẾT QUẢ ĐÁNH GIÁ TỔNG HỢP

# Kết quả đánh giá tổng hợp

| Mô hình | Tỷ lệ trúng Top 5 | Hỏi trúng triệu chứng ẩn | Diễn giải |
| :--- | :---: | :---: | :--- |
| **Hệ thống đề xuất (MedAI)** | **90,0%** | **35,0%** | **Độ chính xác và độ nhạy dẫn đầu** |
| Gemini 3.1 Flash Lite | 85,0% | 11,7% | Độ chính xác tốt |
| GPT-OSS-120B | 85,0% | 20,0% | Độ chính xác tốt |

### 🟩 Khung bên dưới: **Nhận xét**
> **Nhận xét:** Hệ thống đề xuất (MedAI) đạt **90,0% ở Top 5** và độ nhạy hỏi trúng triệu chứng ẩn **35,0%**, cao nhất trong bảng; cho thấy khả năng thu thập thông tin và định hướng chẩn đoán vượt trội.

---

## 📌 SLIDE 4: KẾT LUẬN

# Kết luận

### 🟦 Khung Lớn: **Kết quả chính**
* Hoàn thiện hệ thống khám bệnh tương tác đa vòng dựa trên Đồ thị tri thức SymCAT và thuật toán Bayesian Scoring.
* Tỷ lệ trúng Top 5 đạt **90,0%**, cao hơn các mô hình ngôn ngữ lớn (Gemini 85,0%, GPT-120B 85,0%).
* Độ nhạy hỏi trúng triệu chứng ẩn đạt **35,0%**, cao gấp **1,75x – 3,0x** so với các mô hình đối chiếu.
* **Hướng phát triển:** Mở rộng đồ thị tri thức, tích hợp Computer Vision cho Da Liễu và xét nghiệm cận lâm sàng.
