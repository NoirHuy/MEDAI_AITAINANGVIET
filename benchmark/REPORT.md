# 🩺 BÁO CÁO KẾT QUẢ BENCHMARK LÂM SÀNG TƯƠNG TÁC ĐA VÒNG
### Đánh giá Đối Đầu Thực Nghiệm: MedAI vs Gemini 3.1 Flash Lite vs GPT-OSS-120B

---

## 1. NGUỒN GỐC BỘ DỮ LIỆU THỰC NGHIỆM

* **Tên bộ dữ liệu:** **DDXPlus Benchmark Dataset** (Tập dữ liệu chuẩn quốc tế cho bài toán Chẩn đoán phân biệt y khoa - Differential Diagnosis).
* **Xuất xứ & Bản quyền:** Được nghiên cứu, chuẩn hóa và công bố bởi Viện Nghiên cứu Trí tuệ Nhân tạo Montreal (**MILA** - Montreal Institute for Learning Algorithms) cùng đội ngũ cố vấn y khoa lâm sàng, xuất bản tại Hội nghị khoa học hàng đầu thế giới **NeurIPS (Datasets and Benchmarks Track)**.
* **Quy mô & Cấu trúc trích xuất:**
  * Tập kiểm chuẩn bao gồm **100 ca bệnh lâm sàng chuẩn hóa**, đại diện cho **9 chuyên khoa y tế** quan trọng: Tai Mũi Họng, Tiêu Hóa, Thần Kinh, Tâm Thần, Tim Mạch, Da Liễu, Dị Ứng, Tiết Niệu, Răng Hàm Mặt.
  * Mỗi ca bệnh được cấu trúc đầy đủ: Thông tin nhân khẩu học (Tuổi, Giới tính), Tính chất khởi phát thời gian (Onset & Duration), Lý do đến khám ban đầu (Chief Complaint), Danh sách triệu chứng dương tính có thật trên người bệnh (Confirmed Symptoms), Triệu chứng âm tính phủ nhận (Excluded Symptoms) và Bệnh lý chẩn đoán xác định chuẩn mực (Ground Truth Pathology).

---

## 2. VÌ SAO BỘ DỮ LIỆU DDXPLUS PHÙ HỢP?

1. **Tính độc lập & Khách quan chuẩn mực quốc tế:**
   DDXPlus là bộ dữ liệu công khai, được cộng đồng nghiên cứu Y tế & AI toàn cầu công nhận. Việc sử dụng DDXPlus loại bỏ hoàn toàn hiện tượng thiên lệch dữ liệu (Data Contamination), đảm bảo tính công bằng tuyệt đối giữa các mô hình.
2. **Mô phỏng chính xác quy trình khám bệnh tương tác thực tế (Active Inquiry):**
   Khác với các bộ dữ liệu tĩnh (vốn cấp sẵn 100% triệu chứng từ đầu), DDXPlus được thiết kế đặc thù cho kịch bản hỏi đáp từng bước. Bệnh nhân ban đầu chỉ cung cấp lý do đến khám (1 triệu chứng). Hệ thống phải chủ động lựa chọn câu hỏi lâm sàng để bóc tách các "triệu chứng ẩn", phản ánh đúng thực tế khám chữa bệnh tại phòng khám.
3. **Cung cấp bản đồ triệu chứng chuẩn (Standardized Evidence Ontology):**
   Bộ dữ liệu phân định rạch ròi giữa triệu chứng bệnh nhân có và không có, cho phép xây dựng "Bệnh nhân ảo" (Virtual Patient Oracle) khách quan, phản hồi chính xác câu hỏi của mọi hệ thống AI mà không bị phụ thuộc vào câu chữ.

---

## 3. HAI CHỈ SỐ ĐÁNH GIÁ CỐT LÕI

### 3.1. Tỷ lệ trúng Top 5 (Hit Rate @ 5)
* **Khái niệm:** Tỷ lệ phần trăm các ca bệnh mà bệnh lý mục tiêu (Ground Truth) xuất hiện trong danh sách 5 chẩn đoán phân biệt hàng đầu do mô hình đề xuất sau quy trình hỏi bệnh.
* **Ý nghĩa lâm sàng:** Trong y khoa thực tế, mục tiêu của khâu khám sơ bộ/phân luồng (Triage) không phải là khẳng định độc đoán 1 bệnh duy nhất, mà là đưa ra danh sách chẩn đoán phân biệt (Differential Diagnosis) chính xác và đầy đủ nhất nhằm chỉ định cận lâm sàng phù hợp và ngăn chặn bỏ sót bệnh nguy hiểm.

### 3.2. Tỷ lệ hỏi trúng triệu chứng ẩn (Symptom Discovery Sensitivity)
* **Khái niệm:** Tỷ lệ phần trăm các câu hỏi lâm sàng do mô hình tự động đưa ra được người bệnh xác nhận là **"CÓ"** (trúng vào các triệu chứng thực tế bệnh nhân đang có nhưng chưa khai báo ở câu đầu).
* **Ý nghĩa lâm sàng:** Đo lường độ nhạy bén và năng lực khai thác bệnh sử của thuật toán. Một bác sĩ hỏi bệnh giỏi là người biết đặt những câu hỏi then chốt nhằm phát hiện nhanh các triệu chứng ẩn giúp khoanh vùng bệnh, thay vì đặt các câu hỏi vu vơ mà người bệnh liên tục trả lời "Không".

---

## 4. KẾT QUẢ ĐÁNH GIÁ TỔNG HỢP TOÀN DIỆN (TẬP CHUẨN DDXPLUS)

| Tiêu chí đánh giá lâm sàng | MedAI (Graph + Shannon) | Gemini 3.1 Flash Lite | GPT-OSS-120B (120 tỷ param) | Nhận xét phân tích |
| :--- | :---: | :---: | :---: | :--- |
| ⭐ **TỶ LỆ TRÚNG TOP 5 (Hit Rate @ 5)** | **90.0%** | **85.0%** | **85.0%** | 🏆 **MedAI dẫn đầu về độ chính xác Top 5** |
| 🎯 **Tỷ lệ hỏi trúng triệu chứng ẩn (Sensitivity)** | **35.0%** | **11.7%** | **20.0%** | 🏆 **MedAI vượt trội gấp 1.75x - 3.0x** |

---

*Báo cáo được tổng hợp tự động từ kết quả thực nghiệm tương tác đa vòng trên DDXPlus Benchmark.*
