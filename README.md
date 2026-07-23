---
title: MedChat AI
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
tags:
  - health
  - medical
  - knowledge-graph
  - neo4j
  - bayesian
  - differential-diagnosis
  - vietnamese
license: mit
short_description: Hệ thống trợ lý chẩn đoán phân biệt tích hợp Knowledge Graph & Cổng thanh toán Stripe
---

# 🩺 MedAI — Hệ Thống Trợ Lý Tư Vấn Y Tế & Chẩn Đoán Phân Biệt AI

**MedAI** là hệ thống trợ lý tư vấn y tế và chẩn đoán phân biệt chuyên nghiệp thế hệ mới. Khác biệt hoàn toàn với các chatbot y tế thông thường dễ bị ảo tưởng (hallucination) dữ liệu, MedAI kết hợp **Đồ thị tri thức y khoa lâm sàng (Knowledge Graph - SymCAT/Synthea)**, **Mạng xác suất Bayesian**, **Chuẩn hóa thực thể y tế quốc tế NIH UMLS API** và **Cổng AI Gateway 9Router / OpenRouter** để đưa ra các tư vấn sàng lọc bệnh lý có dẫn chứng y học chứng cứ, cá nhân hóa theo dịch tễ học và an toàn cho người dùng.

---

## 🔗 Liên Kết Hệ Thống (System Direct Links)

Bảng tổng hợp tất cả các liên kết truy cập chính thức của hệ thống MedAI ở cả hai môi trường **Trực tuyến (Production Server)** và **Máy cá nhân (Local Dev)**:

| Dịch Vụ / Trang Chức Năng | Đường Dẫn Trực Tuyến (Production VPS) | Đường Dẫn Máy Cá Nhân (Local Dev) | Mật Khẩu & Ghi Chú Đăng Nhập |
|---|---|---|---|
| 🌐 **Ứng Dụng Web Chat (Khách Hàng)** | [https://103.166.183.89.nip.io](https://103.166.183.89.nip.io)<br>*(hoặc [Cổng 8080](http://103.166.183.89.nip.io:8080))* | [http://localhost:8080](http://localhost:8080) | Giao diện tư vấn y tế AI cho người dùng cuối |
| 📊 **Trang Quản Trị Hệ Thống (Admin)** | [https://103.166.183.89.nip.io/admin](https://103.166.183.89.nip.io/admin) | [http://localhost:8080/admin](http://localhost:8080/admin) | Dashboard theo dõi người dùng, doanh thu & System Logs |
| 🔀 **Bảng Điều Khiển 9Router AI Gateway** | [http://103.166.183.89:20128](http://103.166.183.89:20128) | [http://localhost:20128](http://localhost:20128) | Quản lý API Key & Mô hình LLM<br>🔑 Mật khẩu Dashboard: `113113` |
| ⚡ **Máy Chủ API Backend (REST Service)** | [http://103.166.183.89:4000](http://103.166.183.89:4000) | [http://localhost:4000](http://localhost:4000) | Cổng xử lý logic, CSDL MongoDB & Stripe Payment |
| 🌐 **Đồ Thị Tri Thức Neo4j Cloud** | [Neo4j Workspace Cloud](https://workspace.neo4j.io/) | `neo4j+s://01ebae5f.databases.neo4j.io` | CSDL Đồ thị tri thức lâm sàng SymCAT<br>👤 User: `neo4j`<br>🔑 Password: `1owqwBTQblzpNLGHg1VQFvF4dEH3yxn36lxro7C7ll8` |

---

## 🌟 Hướng Dẫn Sử Dụng Chi Tiết Cho Khách Hàng (User Guide)

### 1. 🩺 Tư Vấn Sức Khỏe & Sàng Lọc Triệu Chứng AI
1. Truy cập vào **[Ứng Dụng Web MedAI](https://103.166.183.89.nip.io)**.
2. **Chọn Chuyên Khoa Y Tế**: Chọn chuyên khoa phù hợp ở thanh menu (Nhi khoa, Tim mạch, Nội khoa, Tiêu hóa, Thần kinh...).
3. **Mô Tả Triệu Chứng Tự Nhiên**: Nhập biểu hiện sức khỏe bằng ngôn ngữ bình dân (ví dụ: *"khát nước liên tục, sốt nhẹ về chiều, mệt mỏi"*).
4. **Trả Lời Câu Hỏi Phân Biệt AI**: Hệ thống tự động truy vấn Đồ thị tri thức Neo4j và đưa ra từ **3 - 5 câu hỏi sàng lọc phân biệt** tập trung nhất để khoanh vùng bệnh.
5. **Nhận Kết Quả Báo Cáo Chẩn Đoán**: MedAI tổng hợp bảng phân tích tỷ lệ % xác suất nghi ngờ bệnh lý, đưa ra khuyến cáo chuyên khoa và các bước xử trí y tế an toàn.

---

### 2. 💳 Quản Lý Tài Khoản, Thẻ Thanh Toán & Gói Thuê Bao Pro
1. **Gói Thuê Bao Linh Hoạt**:
   * **Gói Miễn Phí (Free)**: 50.000 token AI/tháng, truy cập 4 chuyên khoa cơ bản.
   * **Gói Pro Chuyên Gia (99.000đ/tháng)**: 2.000.000 token AI/tháng, mở khóa toàn bộ chuyên khoa mới, ưu tiên tốc độ phản hồi AI.
2. **Quản Lý Thẻ Thanh Toán Quốc Tế (Visa / MasterCard / JCB / AMEX)**:
   * Vào **Cài đặt** $\rightarrow$ chọn tab **Thanh toán**.
   * Nhập thông tin thẻ thanh toán quốc tế của bạn. Hệ thống tích hợp trực tiếp **Cổng thanh toán bảo mật Stripe SDK SDK real-time** để xác thực thẻ.
   * **Tính năng Xóa thẻ**: Cho phép người dùng chủ động xóa thẻ thanh toán khỏi tài khoản bất kỳ lúc nào chỉ với 1 click.
3. **Nâng Cấp Gói Pro Chuẩn Quy Tắc Thanh Toán Thực Tế**:
   * Khi chọn **Chuyển sang Pro**, nếu chưa có thẻ, hệ thống sẽ nhắc nhở người dùng thêm thẻ thanh toán trước.
   * Khi đã có thẻ, hệ thống mở **Modal Xác nhận thanh toán & Trừ tiền (99.000đ)**. Khi bạn bấm xác nhận, tiền sẽ được trừ trực tiếp qua thẻ và tự động nâng cấp gói Pro 30 ngày.

---

### 3. 📊 Trang Quản Trị Hệ Thống (Admin Dashboard)
* **Dành cho Quản trị viên (Admin)**: Truy cập đường dẫn **[/admin](https://103.166.183.89.nip.io/admin)**.
* **Tổng Quan Chỉ Số**: Thống kê số lượng cuộc trò chuyện, doanh thu đăng ký Pro, số lượng người dùng mới, và tổng số token AI tiêu thụ.
* **System Logs**: Xem trực tiếp nhật ký hoạt động thời gian thực của máy chủ backend.

---

### 4. 🌐 Chuyển Đổi Ngôn Ngữ Linh Hoạt (Tiếng Việt / English)
* Người dùng có thể chuyển đổi toàn bộ giao diện ứng dụng giữa **Tiếng Việt** và **Tiếng Anh** chỉ bằng 1 thao tác bấm nút `VI / EN` trên thanh công cụ.

---

## 🔬 Kiến Trúc Công Nghệ Nổi Bật (Technical Architecture)

### 1. 🧬 Đồ Thị Tri Thức Lâm Sàng Neo4j (SymCAT & Synthea)
* **474 Nút Triệu chứng (Symptom nodes)**: Mô tả đầy đủ các biểu hiện lâm sàng.
* **801 Nút Bệnh lý (Disease nodes)**: Danh mục các bệnh lý phổ biến và chuyên khoa.
* **>20.000 Quan hệ liên kết (`HAS_SYMPTOM`)**: Chứa thuộc tính **xác suất dịch tễ (`probability`)** thực tế thu thập từ lịch sử bệnh án lâm sàng.

### 2. 🧮 Thuật Toán Bayesian Scoring & Point Penalty
Khi người dùng phủ nhận triệu chứng (ví dụ: *"tôi không bị ho"*, *"không khó thở"*), đồ thị tri thức sẽ tự động áp dụng cơ chế **Bayesian Point Penalty** để trừ điểm và loại trừ ngay lập tức các bệnh lý không phù hợp.

### 3. 💳 Tích Hợp Cổng Thanh Toán Bảo Mật Stripe & PayOS
* **Stripe SDK (`stripe.paymentIntents` & `stripe.paymentMethods`)**: Xử lý xác thực thẻ và trừ tiền trực tiếp trên hạ tầng đạt chuẩn PCI-DSS cấp độ 1 của Stripe.
* **PayOS VietQR**: Hỗ trợ tạo mã VietQR chuyển khoản ngân hàng tự động.

---

## 🚀 Hướng Dẫn Khởi Chạy Bằng Docker (Docker Deployment)

Hệ thống được đóng gói hoàn chỉnh bằng **Docker Compose**, hỗ trợ khởi chạy chỉ với 1 câu lệnh duy nhất trên cả Windows, Linux và VPS:

```bash
# 1. Khởi chạy toàn bộ 4 dịch vụ (Frontend, Backend, MongoDB, 9Router):
docker compose up -d

# 2. Kiểm tra trạng thái hoạt động của các dịch vụ:
docker compose ps

# 3. Xem nhật ký log của hệ thống:
docker compose logs -f
```

---

*MedAI — Trực quan hóa tri thức y học, nâng tầm trải nghiệm chẩn đoán lâm sàng.*
