---
title: MedAI - Enterprise Clinical AI & Multi-Gateway Platform
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
tags:
  - medical-ai
  - vps-deployment
  - paypal-sdk
  - admin-dashboard
  - 9router-ai-gateway
  - knowledge-graph
  - neo4j
license: mit
short_description: Báo cáo Kiến trúc Hạ tầng Triển khai VPS, Cổng PayPal SDK, Admin Dashboard & 9Router AI Gateway
---

# 🩺 MedAI: System Architecture & Deployment Benchmark Report
### *Hệ Thống Trợ Lý Tư Vấn Y Tế Lâm Sàng Tích Hợp Hạ Tầng VPS Production, Cổng Thanh Toán PayPal SDK, Admin Dashboard & 9Router AI Gateway*

---

## 📌 1. BẢN ĐỒ TRIỂN KHAI HỆ THỐNG & ĐIỂM CUỐI DỊCH VỤ (SYSTEM LINKS & SITEMAP)

Hệ thống MedAI được triển khai trực tiếp trên hạ tầng máy chủ ảo riêng **VPS (Virtual Private Server)** kết hợp cơ chế Reverse Proxy Caddy, chứng chỉ mã hóa SSL và Docker Compose orchestrator.

Bảng thông tin chi tiết các phân hệ dịch vụ (thông tin xác thực xem `.env`):

| Phân Hệ Dịch Vụ | Đường Dẫn Production | Đường Dẫn Local Dev | Ghi Chú |
|---|---|---|---|
| 🌐 **Ứng Dụng Web Client** | `https://<your-domain>` | `http://localhost:8080` | React 19 SPA, Responsive Glassmorphism, Đa ngôn ngữ (VI/EN) |
| 📊 **Trang Quản Trị (Admin)** | `https://<your-domain>/admin` | `http://localhost:8080/admin` | Giám sát vận hành, theo dõi doanh thu, thống kê token |
| 🔀 **9Router AI Gateway** | `http://<vps-ip>:20128` | `http://localhost:20128` | Quản trị API Key, Load Balancing & Failover |
| ⚡ **Backend API** | `http://<vps-ip>:4000` | `http://localhost:4000` | Node.js Express, JWT Auth, MongoDB & PayPal Payment |
| 🌐 **Neo4j Knowledge Graph** | Xem dashboard Neo4j Aura | `neo4j+s://...databases.neo4j.io` | Tri thức y khoa SymCAT (474 triệu triệu chứng, 801 bệnh lý) |

> **Lưu ý:** Thông tin xác thực (password, API key, secret) được cấu hình trong file `.env`. Không lưu credentials trong code hoặc tài liệu công khai.

---

## 🚀 2. HẠ TẦNG TRIỂN KHAI MÁY CHỦ VPS & CADDY AUTO-SSL (PRODUCTION DEPLOYMENT)

Hệ thống được thiết kế và vận hành trên môi trường **Cloud VPS** theo tiêu chuẩn hạ tầng doanh nghiệp:

* **Tự Động Cấp & Gia Hạn SSL Qua Caddy Container (Caddy Auto-HTTPS)**: Tích hợp Caddy Server Container làm Reverse Proxy cao cấp, tự động đăng ký, xác thực ACME và gia hạn chứng chỉ mã hóa an toàn **HTTPS SSL (Let's Encrypt / ZeroSSL)** hoàn toàn tự động 100%.
* **Đóng Gói Container Khối (Docker Compose Architecture)**: Các dịch vụ cốt lõi (Caddy Reverse Proxy, Frontend, Backend, MongoDB 7.0 và 9Router AI Gateway) được container hóa cô lập, quản lý và sẵn sàng khởi chạy đồng bộ với 1 lệnh duy nhất.
* **Độ Ổn Định & Khả Năng Mở Rộng**: Cơ sở dữ liệu MongoDB 7.0 và Neo4j AuraDB Cloud đảm bảo tối ưu hóa phần cứng, hoạt động liên tục 24/7 không đứt gãy.

---

## 🔀 3. QUẢN LÝ TẬP TRUNG MÔ HÌNH AI QUA 9ROUTER AI GATEWAY

MedAI tích hợp hạ tầng **9Router AI Gateway** để đảm bảo khả năng chịu lỗi và cân bằng tải:

* **Quản Lý API Key Tập Trung**: Cập nhật, xoay vòng (Rotate) và thiết lập hạn mức chi phí cho các API Key (OpenRouter, Gemini 3.1 Flash, DeepSeek-v4) từ một giao diện duy nhất mà không cần khởi động lại máy chủ backend.
* **Tự Động Cân Bằng Tải & Điều Hướng Dự Phòng (Load Balancing & Dynamic Failover)**: Khi mô hình chính gặp sự cố quá tải hoặc hết rate-limit, 9Router tự động điều chuyển yêu cầu chẩn đoán sang mô hình dự phòng với độ trễ thấp.
* **Giám Sát Latency & Token Analytics**: Theo dõi số liệu thời gian phản hồi (Latency ms) và lượng Token tiêu thụ của từng cuộc gọi AI theo thời gian thực.

> Thông tin đăng nhập 9Router: xem biến môi trường tương ứng trong `.env`.

---

## 💳 4. CỔNG THANH TOÁN QUỐC TẾ PAYPAL SDK REAL-TIME

Hệ thống tích hợp giải pháp thanh toán thương mại điện tử qua **PayPal REST API v2** nhằm cung cấp quy trình nâng cấp gói Pro y tế cao cấp (99.000đ/tháng) hoàn chỉnh:

* **Xác Thực Thẻ Bảo Mật (PayPal PaymentMethods)**: Hỗ trợ thanh toán bằng thẻ Visa, MasterCard, JCB, AMEX trên hạ tầng PayPal.
* **Thanh Toán Đơn Hàng (PayPal Orders API)**: Khởi tạo và xác nhận giao dịch 99.000 VNĐ qua PayPal.
* **Tự Động Kích Hoạt Gói Pro 30 Ngày**: Ngay khi giao dịch PayPal báo trạng thái `COMPLETED`, backend kích hoạt quyền truy cập gói Pro, lưu ngày hết hạn 30 ngày và ghi nhận lịch sử giao dịch.
* **Quản Lý Thanh Toán & Chống Trừ Tiền Nhầm**:
  - Hỗ trợ xem và quản lý phương thức thanh toán.
  - Bắt buộc xác nhận trước khi nâng cấp.
  - Vô hiệu hóa nút hạ cấp thủ công từ Pro về Free để tuân thủ chu kỳ gói gia hạn.

---

## 📊 5. TRANG QUẢN TRỊ AN TOÀN & VẬN HÀNH DỰ ÁN (ADMIN DASHBOARD)

Trang quản trị hệ thống cung cấp cho đội ngũ vận hành và nhà quản lý cái nhìn toàn diện:

* **Thống Kê Doanh Thu Real-time**: Tổng hợp tổng doanh thu từ các giao dịch thanh toán gói Pro qua PayPal.
* **Giám Sát Cuộc Trò Chuyện & Mức Độ Khẩn Cấp**: Thống kê số lượt tư vấn y tế (Hôm nay / Tuần / Tháng), phân loại mức độ khẩn cấp và danh mục Triệu chứng phổ biến.
* **Nhật Ký Vận Hành (System Logs & Token Audit)**: Theo dõi thời gian phản hồi trung bình của hệ thống (ms), tỷ lệ lỗi và thống kê chi phí API token AI.
* **Giám Sát An Toàn Y Tế (Safety Emergency Audit)**: Danh sách tổng hợp các phiên tư vấn có dấu hiệu cấp cứu hoặc bị gắn cờ cần kiểm duyệt y khoa.

---

## 🔮 6. ĐỊNH HƯỚNG PHÁT TRIỂN TƯƠNG LAI (FUTURE DEVELOPMENT ROADMAP)

### 1. 🧠 Cơ Chế Ghi Nhớ Ngữ Cảnh Người Dùng Dài Hạn (Long-term User Memory & Dynamic Profiling)
* **Tóm Tắt Hội Thoại Tự Động (Dialogue Summarization Engine)**: Tự động chạy tiến trình ngầm phân tích các phiên chat để cô đọng nội dung tư vấn thành các thẻ tri thức ngắn gọn.
* **Trích Xuất Hồ Sơ Sức Khỏe Cá Nhân (Patient Profile Extraction)**: Tự động nhận diện và bóc tách các thuộc tính y tế quan trọng của người bệnh bao gồm:
  - **Tiền sử bệnh lý nền**: *Tiểu đường Type 2, Cao huyết áp, Hen suyễn...*
  - **Dị ứng & Phản ứng thuốc**: *Dị ứng Penicillin, Aspirin...*
  - **Yếu tố nguy cơ & Thói quen sinh hoạt**: *Hút thuốc, Tiền sử gia đình mắc bệnh tim mạch...*
* **Cập Nhật Động**: Dữ liệu hồ sơ người dùng được mã hóa và lưu trữ an toàn trong `user_memory`, liên tục được tích lũy và cập nhật qua các lượt trò chuyện theo thời gian.

### 2. 📚 Kiến Trúc Hybrid GraphRAG (Retrieval-Augmented Generation + Knowledge Graph)
* **Tích Hợp Cơ Sở Dữ Liệu Vector (Vector Database)**: Kết hợp Vector Embeddings để truy vấn ngữ nghĩa sâu từ sách y khoa và phác đồ điều trị chính thống.
* **Truy Xuất Tri Thức Đa Tầng (Hybrid Retrieval)**: Khi người bệnh đặt câu hỏi, hệ thống thực hiện đồng thời:
  1. **Graph Retrieval**: Trích xuất quan hệ xác suất Bệnh lý - Triệu chứng từ Đồ thị Neo4j.
  2. **Vector RAG Retrieval**: Truy xuất hồ sơ sức khỏe cá nhân của người dùng và tài liệu y khoa liên quan.
* **Tư Vấn Cá Nhân Hóa Đột Phá**: Đưa toàn bộ ngữ cảnh tiền sử bệnh và tri thức y học vào prompt của LLM, giúp MedAI đóng vai trò như một **Bác sĩ gia đình AI** hiểu rõ lịch sử sức khỏe dài hạn của từng bệnh nhân.

---

## 🛠️ 7. HƯỚNG DẪN CẤU HÌNH & KHỞI CHẠY (SETUP GUIDE)

### 7.1. Cấu hình biến môi trường

```bash
# Sao chép file mẫu
cp back_end/.env.example back_end/.env

# Chỉnh sửa back_end/.env với các giá trị thực tế:
# - JWT_SECRET, MEMORY_ENCRYPTION_KEY: Tạo bằng node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# - NEO4J_PASSWORD: Đặt password mới cho Neo4j
# - PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET: Lấy từ developer.paypal.com
# - Các API key AI: Cấu hình trong 9Router dashboard hoặc .env
```

### 7.2. Khởi chạy bằng Docker

```bash
# 1. Khởi chạy toàn bộ hạ tầng container:
docker compose up -d

# 2. Kiểm tra trạng thái container:
docker compose ps

# 3. Xem log vận hành backend thời gian thực:
docker compose logs -f backend

# 4. Chạy tests:
cd back_end && npm install && npm test
```

---

*MedAI — Infrastructure Resilience, AI Orchestration & Evidence-Based Clinical Systems.*
