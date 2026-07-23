---
title: MedAI - Knowledge Graph-Grounded Clinical Differential Diagnosis System
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
tags:
  - medical-ai
  - clinical-nlp
  - knowledge-graph
  - neo4j
  - bayesian-inference
  - differential-diagnosis
  - umls-cui
  - stripe-sdk
license: mit
short_description: Hệ thống Trợ lý Chẩn đoán Phân biệt Lâm sàng Tích hợp Đồ thị Tri thức & AI Gateway
---

# 🩺 MedAI: Clinical Knowledge Graph-Grounded Differential Diagnosis System
### *Hệ Thống Trợ Lý Chẩn Đoán Phân Biệt Lâm Sàng Tích Hợp Đồ Thị Tri Thức Y Khoa, Mạng Bayesian & Cổng Thanh Toán Stripe*

---

## 📌 Tổng Quan Dự Án & Đặt Vấn Đề (Executive Summary)

Trong lĩnh vực y tế số, các mô hình ngôn ngữ lớn (LLM) thông thường dễ gặp phải hiện tượng **ảo tưởng dữ liệu (Hallucination)** và thiếu tính căn cứ y học chứng cứ (Evidence-Based Medicine). **MedAI** được nghiên cứu và phát triển nhằm giải quyết triệt để thách thức này bằng cách kết hợp **Đồ thị tri thức y khoa lâm sàng (Clinical Knowledge Graph - SymCAT/Synthea)**, **Thuật toán suy luận xác suất Bayesian**, **Hệ thống chuẩn hóa thực thể y tế NIH UMLS CUI** và **Cổng điều phối đa mô hình AI (9Router AI Gateway)**.

Hệ thống cung cấp giải pháp sàng lọc chẩn đoán phân biệt (Differential Diagnosis) chính xác, cá nhân hóa theo xác suất dịch tễ học thực tế, hỗ trợ đa ngôn ngữ (Việt - Anh) và tích hợp hạ tầng thanh toán thương mại điện tử quốc tế chuẩn PCI-DSS (Stripe SDK & PayOS).

---

## 🔗 Bản Đồ Liên Kết & Thông Tin Truy Cập Hệ Thống (Deployment Topology & Credentials)

Bảng tổng hợp toàn bộ các phân hệ dịch vụ, điểm cuối API và thông tin xác thực quản trị của hệ thống MedAI trên môi trường **Máy chủ VPS Trực tuyến (Production)** và **Môi trường Phát triển (Local Dev)**:

| Phân Hệ Dịch Vụ / Chức Năng | Máy Chủ Trực Tuyến (VPS Production) | Môi Trường Local (Local Dev) | Thông Tin Xác Thực / Ghi Chú Kỹ Thuật |
|---|---|---|---|
| 🌐 **Cổng Giao Diện Web Chat (Client UI)** | [https://103.166.183.89.nip.io](https://103.166.183.89.nip.io)<br>*(HTTP Port 8080: `http://103.166.183.89.nip.io:8080`)* | [http://localhost:8080](http://localhost:8080) | Giao diện React 19 SPA, hỗ trợ đa ngôn ngữ (VI/EN) & Responsive Glassmorphism |
| 📊 **Trang Quản Trị Hệ Thống (Admin Dashboard)** | [https://103.166.183.89.nip.io/admin](https://103.166.183.89.nip.io/admin) | [http://localhost:8080/admin](http://localhost:8080/admin) | Giám sát vận hành, doanh thu, thống kê token AI & System Logs thời gian thực |
| 🔀 **Bảng Điều Khiển 9Router AI Gateway** | [http://103.166.183.89:20128](http://103.166.183.89:20128) | [http://localhost:20128](http://localhost:20128) | Quản lý Load Balancing & Failover giữa các LLM<br>🔑 **Password**: `113113` |
| ⚡ **Máy Chủ API Backend (RESTful Service)** | [http://103.166.183.89:4000](http://103.166.183.89:4000) | [http://localhost:4000](http://localhost:4000) | Node.js Express, JWT Auth, CSDL MongoDB & Cổng Stripe Payment API |
| 🌐 **Cơ Sở Dữ Liệu Đồ Thị Neo4j Cloud** | [Neo4j Workspace Cloud](https://workspace.neo4j.io/) | `neo4j+s://01ebae5f.databases.neo4j.io` | Lưu trữ Đồ thị tri thức SymCAT (474 triệu chứng, 801 bệnh lý)<br>👤 **User**: `neo4j`<br>🔑 **Password**: `1owqwBTQblzpNLGHg1VQFvF4dEH3yxn36lxro7C7ll8` |

---

## 🏛️ Đổi Mới Công Nghệ & Kiến Trúc Cốt Lõi (Key Architectural Innovations)

```
[Khách hàng nhập mô tả tự nhiên] 
       │
       ▼
[NLM NIH UMLS CUI API] ──► (Ánh xạ Thực thể Y tế) ──► [Neo4j SymCAT Knowledge Graph]
                                                                  │
[Phản hồi & Câu hỏi Entropy] ◄── [Bayesian Point Penalty Engine] ◄┘
       │
       ▼
[Stripe Gateway / 9Router LLM] ──► [Admin Operations Analytics & Safety Audit Logs]
```

### 1. 🧬 Đồ Thị Tri Thức Y Khoa Lâm Sàng (Clinical Knowledge Graph - SymCAT)
Hệ thống vận hành trên CSDL đồ thị **Neo4j AuraDB** được cấu trúc hóa từ dữ liệu dịch tễ lâm sàng SymCAT & Synthea:
* **474 Nút Triệu chứng (Symptom Nodes)**: Định danh các biểu hiện lâm sàng tiêu chuẩn.
* **801 Nút Bệnh lý (Disease Nodes)**: Danh mục các bệnh lý chuyên khoa và đa khoa.
* **>20.000 Quan hệ liên kết (`HAS_SYMPTOM`)**: Lưu trữ giá trị **xác suất dịch tễ $P(\text{Triệu chứng} \mid \text{Bệnh lý})$** thu thập từ bệnh án thực tế.
* **Thuộc tính nhân khẩu học (`AFFECTS_AGE`, `AFFECTS_SEX`)**: Trọng số phân bố theo độ tuổi và giới tính.

### 2. 🔤 Ánh Xạ Thực Thể Đa Tầng (Multi-stage Medical Entity Extraction)
Chuyển đổi các mô tả triệu chứng bằng tiếng Việt tự nhiên sang các mã CUI (Concept Unique Identifier) chuẩn hóa của Thư viện Y học Quốc gia Hoa Kỳ (NIH UMLS API):
$$\text{Mô tả tự nhiên (Tiếng Việt)} \xrightarrow{\text{LLM Extraction}} \text{Medical Term (English)} \xrightarrow{\text{NIH UMLS API}} \text{UMLS CUI Code} \xrightarrow{\text{Graph Link}} \text{SymCAT Node}$$

### 3. 🧮 Thuật Toán Bayesian Scoring & Trừ Điểm Triệu Chứng Phủ Định (Point Penalty)
Xử lý chính xác các triệu chứng bị người bệnh phủ định (ví dụ: *"tôi không sốt", "không ho"*). Thuật toán áp dụng cơ chế **Bayesian Point Penalty** để giảm điểm trọng số và hạ thứ hạng bệnh nghi ngờ ngay lập tức, tránh chẩn đoán sai lệch.

### 4. ❓ Đặt Câu Hỏi Thu Hẹp Diện Chẩn Đoán Dựa Trên Entropy (Information Gain)
Thay vì đặt câu hỏi tràn lan, hệ thống tính toán **Độ lệch chuẩn Entropy** của tập triệu chứng chưa khám phá giữa Top các bệnh nghi ngờ hàng đầu. Hệ thống sẽ tự động chọn **3 đến 5 triệu chứng có giá trị phân biệt cao nhất** để đưa ra câu hỏi sàng lọc tiếp theo.

### 5. 💳 Cổng Thanh Toán Quốc Tế Stripe SDK Real-time & Quyền Lợi Gói Thuê Bao
* **Tích hợp SDK Stripe PCI-DSS Level 1**: Quản lý thẻ thanh toán quốc tế (Visa, MasterCard, JCB, AMEX), hỗ trợ tạo `PaymentMethod` và thực thi `PaymentIntent` trừ tiền thực tế.
* **Quản lý Thẻ & Quy tắc Thanh toán Thực tế**:
  - Hỗ trợ xem thông tin thẻ đã lưu và chủ động xóa thẻ an toàn.
  - Bắt buộc thêm thẻ trước khi nâng cấp gói Pro.
  - Hiển thị Modal xác nhận thanh toán **99.000đ/tháng** trước khi thực hiện giao dịch trừ tiền.
  - Khi đang ở gói Pro, hệ thống khóa nút hạ cấp thủ công về Free, chỉ cho phép quản lý công tắc *Gia hạn tự động*.

---

## 📈 Kiểm Chứng Vận Hành & Giao Dịch Thực Tế (Operational & Payment Analytics)

Hệ thống được kiểm thử thực tế và ghi nhận đầy đủ các giao dịch thanh toán trực tuyến trên **Stripe Dashboard** và **Admin Analytics Dashboard**:

![Bảng điều khiển giao dịch thanh toán Stripe Dashboard của MedAI](./docs/images/stripe_dashboard.png)
*Hình 1: Bảng điều khiển giao dịch thanh toán trực tuyến thực tế trên Stripe Dashboard của hệ thống MedAI ($3.76 Gross Volume).*

---

## 🛠️ Công Nghệ Phát Triển (Technology Stack)

* **Frontend**: React 19, Vite, Vanilla CSS Design System, Responsive Glassmorphic UI.
* **Backend**: Node.js, Express REST API, Mongoose ODM, JWT Authentication.
* **Databases**: 
  - **MongoDB**: Lưu trữ tài khoản người dùng, lịch sử phiên chat, nhật ký hệ thống (System Logs) và lịch sử giao dịch thanh toán (`payments`).
  - **Neo4j AuraDB**: Cơ sở dữ liệu Đồ thị Tri thức Y khoa Lâm sàng SymCAT.
* **AI & Integration**: 9Router Multi-LLM Gateway, OpenRouter API (`deepseek/deepseek-v4-flash`), NIH NLM UMLS REST API, Stripe Node SDK.

---

## 📦 Hướng Dẫn Triển Khai Hệ Thống Bằng Docker (Enterprise Docker Deployment)

Toàn bộ hệ thống MedAI đã được đóng gói container hóa hoàn chỉnh qua **Docker Compose**:

```bash
# 1. Khởi chạy toàn bộ 4 phân hệ dịch vụ (Frontend, Backend, MongoDB, 9Router):
docker compose up -d

# 2. Kiểm tra trạng thái hoạt động của các container:
docker compose ps

# 3. Theo dõi log vận hành của hệ thống:
docker compose logs -f backend
```

---

*MedAI — Systems Engineering & Evidence-Based Clinical Artificial Intelligence.*
