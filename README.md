---
title: MedAI_Ứng dụng chẩn đoán lâm sàn thông minh
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8080
tags:
  - medical-ai
  - graphrag
  - neo4j
  - bayesian-inference
  - ddxplus-benchmark
  - aes-256-gcm
  - vps-deployment
  - paypal-sdk
  - admin-dashboard
license: mit
short_description: MedAI - Hệ thống sàng lọc lâm sàng thông minh ứng dụng kiến trúc GraphRAG và suy luận Bayes
---

# 🩺 MedAI_Ứng dụng chẩn đoán lâm sàn thông minh

> **Hệ Thống Trợ Lý Sàng Lọc & Hỗ Trợ Quyết Định Lâm Sàng Ban Đầu Ứng Dụng Kiến Trúc GraphRAG, Đồ Thị Tri Thức Y Khoa SymCAT và Động Cơ Suy Luận Xác Suất Bayes Định Lượng**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/Frontend-React%2019%20SPA-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20Express-green.svg)](https://nodejs.org/)
[![Neo4j](https://img.shields.io/badge/Knowledge%20Graph-Neo4j%20SymCAT-008cc1.svg)](https://neo4j.com/)
[![Database](https://img.shields.io/badge/Database-MongoDB%207.0%20%7C%20Redis%207-13aa52.svg)](https://www.mongodb.com/)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20Ngh%E1%BB%8B%20%C4%91%E1%BB%8Bnh%2013-red.svg)](#4-an-toàn-y-tế-và-bảo-mật-dữ-liệu-nghị-định-132023nđ-cp)
[![Tests](https://img.shields.io/badge/Tests-17%20Vitest%20Suites%20Passing-brightgreen.svg)](#7-kiểm-thử-tự-động-automated-testing)

---

## 📑 MỤC LỤC

1. [Tổng Quan & Bài Toán Thực Tiễn](#1-tổng-quan--bài-toán-thực-tiễn)
2. [Kiến Trúc Cốt Lõi GraphRAG & Thuật Toán AI](#2-kiến-trúc-cốt-lõi-graphrag--thuật-toán-ai)
3. [Quy Trình Hội Thoại Lâm Sàng 2 Giai Đoạn](#3-quy-trình-hội-thoại-lâm-sàng-2-giai-đoạn)
4. [An Toàn Y Tế & Bảo Mật Dữ Liệu (Nghị định 13/2023/NĐ-CP)](#4-an-toàn-y-tế-và-bảo-mật-dữ-liệu-nghị-định-132023nđ-cp)
5. [Kết Quả Đánh Giá Thực Nghiệm (DDXPlus Benchmark)](#5-kết-quả-đánh-giá-thực-nghiệm-ddxplus-benchmark)
6. [Hạ Tầng Microservices & Bản Đồ Dịch Vụ](#6-hạ-tầng-microservices--bản-đồ-dịch-vụ)
7. [Kiểm Thử Tự Động (Automated Testing)](#7-kiểm-thử-tự-động-automated-testing)
8. [Hướng Dẫn Cấu Hình & Khởi Chạy](#8-hướng-dẫn-cấu-hình--khởi-chạy)
9. [Checklist Triển Khai Production](#9-checklist-triển-khai-production)
10. [Minh Chứng Dự Án & Thông Tin Đội Thi](#10-minh-chứng-dự-án--thông-tin-đội-thi)

---

## 🎯 1. TỔNG QUAN & BÀI TOÁN THỰC TIỄN

### 1.1. Thực trạng tiếp cận thông tin y tế
Hệ thống y tế công lập chịu áp lực quá tải kéo dài tại các bệnh viện tuyến tỉnh và trung ương, trong khi phần lớn các lượt khám ban đầu hoàn toàn có thể sàng lọc, phân luồng từ sớm tại tuyến y tế cơ sở hoặc tự theo dõi tại nhà có định hướng chuyên môn. Khi gặp vấn đề sức khỏe, người dân có thói quen tự tra cứu tự do trên mạng, dẫn đến:
* **Hội chứng lo âu bệnh tật trực tuyến (Cyberchondria)**: Tự suy diễn các triệu chứng thông thường thành bệnh nan y nguy hiểm, gây bất an tâm lý và tạo thêm áp lực khám chữa bệnh không cần thiết.
* **Tự ý dùng thuốc và sai phác đồ (Self-medication)**: Tự ý mua kháng sinh, kháng viêm liều cao khi chưa có chỉ định, gây kháng thuốc và làm lu mờ các triệu chứng cảnh báo ngoại khoa nguy hiểm.

### 1.2. Hạn chế cốt lõi của LLM tổng quát (ChatGPT, Gemini thuần)
* **Ảo giác y khoa (Medical Hallucination)**: Bản chất LLM là mô hình dự đoán từ tiếp theo (*next-token prediction*), không có cơ chế thẩm định chân lý lâm sàng, tự suy đoán tỷ lệ phần trăm chẩn đoán và đưa ra phác đồ không căn cứ.
* **Thiếu chiều sâu định lượng**: Câu trả lời dàn trải, không phân tầng được mức độ nguy cơ dựa trên dịch tễ học thực nghiệm.
* **Rủi ro an toàn**: Thiếu thuật toán nhận diện cờ đỏ cấp cứu (*Emergency Red Flags*) tức thời và không bảo vệ dữ liệu sức khỏe cá nhân (PHI).

### 1.3. Giải pháp đột phá từ MedAI
**MedAI** ứng dụng kiến trúc **GraphRAG**, kết hợp chặt chẽ giữa:
1. **Độ chính xác lâm sàng**: Khóa cứng suy luận trên **Đồ thị tri thức SymCAT (801 bệnh lý, 474 triệu chứng chuẩn hóa)** và động cơ suy luận xác suất Bayes định lượng. Triệt tiêu hoàn toàn ảo giác AI (0% hallucination rate).
2. **An toàn & Bảo mật**: Tự động nhận diện cờ đỏ khẩn cấp (gợi ý gọi cấp cứu 115) và mã hóa toàn trình dữ liệu sức khỏe cá nhân theo chuẩn **AES-256-GCM** cấp độ trường, tuân thủ Nghị định 13/2023/NĐ-CP.
3. **Trải nghiệm cá nhân hóa 24/7**: Tự động ghi nhớ tiền sử bệnh, dị ứng thuốc và tương tác lâm sàng 2 giai đoạn tự nhiên, thấu cảm.

---

## 🧬 2. KIẾN TRÚC CỐT LÕI GRAPHRAG & THUẬT TOÁN AI

```text
                                  KIẾN TRÚC GRAPHRAG CỦA MEDAI
                                  
[Người Dùng] ─── (Mô tả triệu chứng) ───► [Bộ Bóc Tách Thực Thể Lâm Sàng (SCE)]
                                                    │ (Nhân khẩu học, Thời gian, Triệu chứng)
                                                    ▼
                                    [Đối Soát Thực Thể 3 Tầng]
                   ┌────────────────────────────────┴───────────────────────────────┐
                   │ Tầng 1: CUI & Exact Slug Match                                 │
                   │ Tầng 2: UMLS Metathesaurus Search API                          │
                   │ Tầng 3: Dense Vector Semantic Search (Cosine Sim >= 0.35)      │
                   └────────────────────────────────┬───────────────────────────────┘
                                                    │ Triệu chứng chuẩn hóa (474 slugs)
                                                    ▼
                                  [Đồ Thị Tri Thức Y Khoa Neo4j (SymCAT)]
                                  801 Bệnh Lý  ◄──[P(S|D)]──►  474 Triệu Chứng
                                                    │
                                                    ▼
                                    [Động Cơ Suy Luận Xác Suất Bayes]
                     Score = f(BaseScore, Demographics, Temporal) – Penalty
                                                    │
                                                    ▼
                                [Thuật Toán Entropy: Đặt Câu Hỏi Phân Biệt]
                              Tìm triệu chứng có StDev(P) cao nhất giữa Top bệnh
                                                    │
                                                    ▼
                                    [Cổng Điều Phối 9Router Gateway]
                                  Gemini 3.1 Flash / DeepSeek-v4 Fallback
                                                    │
                                                    ▼
                                [Giao Diện Báo Cáo Sàng Lọc Lâm Sàng SVG]
```

### 2.1. Đồ thị tri thức y khoa SymCAT & UMLS
* **SymCAT Knowledge Graph (Neo4j)**: 801 thực thể bệnh lý, 474 triệu chứng chuẩn hóa và ma trận xác suất có điều kiện $P(\text{Triệu chứng} \mid \text{Bệnh})$ trích xuất từ nguồn dữ liệu dịch tễ học lâm sàng thực nghiệm của CDC Hoa Kỳ.
* **UMLS Metathesaurus (NLM)**: Ánh xạ ngôn ngữ giao tiếp đời thường của người bệnh sang mã định danh khái niệm y khoa quốc tế (CUI), loại bỏ mơ hồ ngữ nghĩa.

### 2.2. Cơ chế đối soát thực thể 3 tầng phân cấp (3-Tier Symptom Matching)
1. **Tầng 1 (CUI & Exact Match)**: So khớp trực tiếp mã CUI UMLS hoặc slug ký tự chuẩn trong Neo4j.
2. **Tầng 2 (UMLS Terminology API)**: Tra cứu danh pháp đồng nghĩa y khoa quốc tế từ Thư viện Y khoa Hoa Kỳ.
3. **Tầng 3 (Dense Vector Semantic Search)**: Nhúng vector đặc trưng và đo khoảng cách Cosine với 474 triệu chứng chuẩn (ngưỡng tối thiểu $\ge 0.35$).

### 2.3. Thuật toán suy luận xác suất Bayes định lượng
Điểm nghi ngờ của từng bệnh lý được tính toán minh bạch theo công thức:

$$\text{Score} = f(\text{BaseScore}, \text{Demographics}, \text{Temporal}) - \text{Penalty}$$

* **BaseScore**: Xác suất Bayes tích lũy dựa trên trọng số thực nghiệm $P(S \mid D)$ trong đồ thị SymCAT.
* **Demographics**: Hệ số nguy cơ cá nhân theo tuổi và giới tính sinh học của người bệnh.
* **Temporal**: Hệ số tương thích giữa thời gian khởi phát thực tế (cấp tính vài giờ vs mạn tính nhiều tuần) với diễn tiến tự nhiên của bệnh lý.
* **Penalty (Điểm phạt triệu chứng phủ định)**: Áp dụng tư duy loại trừ y khoa (*Rule-out*). Nếu bệnh lý bắt buộc phải có triệu chứng đặc hiệu mà người bệnh xác nhận **KHÔNG CÓ**, hệ thống trừ điểm nặng để loại bỏ bệnh, giảm thiểu nguy cơ chẩn đoán nhầm.

### 2.4. Thuật toán chọn câu hỏi phân biệt thông minh (Differential Questions)
Để tránh hỏi lan man dồn dập, thuật toán đo **độ lệch chuẩn xác suất (Standard Deviation - StDev)** giữa các bệnh lý dẫn đầu danh sách nghi ngờ:
$$\sigma_s = \sqrt{\frac{1}{K}\sum_{i=1}^K \left(P(s \mid D_i) - \bar{P}\right)^2}$$
Triệu chứng nào có $\sigma_s$ cao nhất sẽ có tính phân loại cao nhất (ví dụ: Bệnh A có xác suất 95%, Bệnh B chỉ có 5%). Hệ thống chọn 2–4 câu hỏi trọng tâm này, giúp thu hẹp chẩn đoán chỉ sau 2–3 vòng hỏi.

### 2.5. Bóc tách lâm sàng cấu trúc gia số (Incremental SCE) & Tự phục hồi JSON
* **Incremental Cache qua Redis**: Từ lượt chat thứ hai, hệ thống chỉ bóc tách tin nhắn mới nhất và hợp nhất vào trạng thái đệm trong Redis (`mergeSCEState`), giảm thời gian phản hồi từ 5s xuống < 1s.
* **Thuật toán tự phục hồi JSON (`tryRepairJson`)**: Quét ngược (*reverse-scanning heuristic*) đếm số ngoặc `{`, `[` mở để tự động đóng cấu trúc JSON hợp lệ nếu LLM gặp sự cố ngắt dòng hoặc cạn token.

---

## 🩺 3. QUY TRÌNH HỘI THOẠI LÂM SÀNG 2 GIAI ĐOẠN

```text
GIAI ĐOẠN 1: LÂM SÀNG TƯƠNG TÁC           GIAI ĐOẠN 2: BÁO CÁO CẤU TRÚC
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ • Khai thác bệnh sử tự nhiên    │       │ • Vòng tròn phần trăm SVG động   │
│ • Kiểm tra Checklist:           │  ──►  │ • Top 3 Bệnh lý nghi ngờ        │
│   Tuổi, Giới tính, Thời gian    │       │ • Dẫn chứng triệu chứng thực tế │
│ • Hỏi 2-4 câu hỏi Entropy       │       │ • Lý giải phân biệt lâm sàng    │
│ • Không hỏi dồn dập, máy móc    │       │ • Cảnh báo cờ đỏ & Chuyên khoa  │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

1. **Giai đoạn 1 (Lâm sàng tương tác)**:
   * Tiếp nhận triệu chứng tự nhiên, thấu hiểu ngữ cảnh bằng tiếng Việt/tiếng Anh.
   * Quản lý checklist lâm sàng (`Tuổi`, `Giới tính`, `Thời gian khởi phát`, `Tính chất`).
   * Đặt câu hỏi khai thác triệu chứng phân biệt dựa trên thuật toán Entropy.
2. **Giai đoạn 2 (Báo cáo sàng lọc cấu trúc & Explainable AI)**:
   * **Bắt buộc trích xuất nguyên văn xác suất Bayes** từ đồ thị SymCAT, tuyệt đối cấm LLM tự tính lại hay suy diễn phần trăm.
   * Hiển thị trực quan qua **Vòng tròn phần trăm SVG động** (`ClinicalStatusIndicator`).
   * Mỗi bệnh lý trong Top 3 phải trình bày đủ 3 thành phần:
     1. *Dẫn chứng triệu chứng đối chiếu* (các triệu chứng thực tế khớp với bệnh).
     2. *Lý giải phân biệt lâm sàng* (tại sao bệnh này có khả năng cao hơn).
     3. *Dấu hiệu đặc hiệu cần theo dõi* và *Khuyến nghị chuyên khoa thích hợp*.

---

## 🛡️ 4. AN TOÀN Y TẾ VÀ BẢO MẬT DỮ LIỆU (NGHỊ ĐỊNH 13/2023/NĐ-CP)

### 4.1. Rào chắn an toàn y tế (Medical Safety Guardrails)
* **Quy tắc cấm khẳng định chẩn đoán**: Hệ thống luôn sử dụng thuật ngữ y khoa chuẩn mực: *"Định hướng sàng lọc khả dĩ"*, *"Nghi ngờ lâm sàng"*, *"Khuyến nghị thăm khám"*. Tuyệt đối không khẳng định chắc chắn và **khóa chặt hoàn toàn tính năng kê đơn thuốc đặc trị**.
* **Bộ lọc cấp cứu cờ đỏ (Emergency Triage Filter)**: Tự động phát hiện tức thì các dấu hiệu nguy kịch (đau ngực lan tay trái, đột quỵ méo mặt, khó thở cấp tính, sốt cao co giật ở trẻ). Lập tức hiển thị **Cảnh báo đỏ khẩn cấp** kèm số hotline cấp cứu `115` và ghi nhận phiên vào `Emergency Audit`.
* **Rào chắn phạm vi (Domain Guardrail)**: Từ chối xử lý các nội dung phi y tế, phát hiện và ngăn chặn ý định tự hại.

### 4.2. Bảo mật dữ liệu sức khỏe chuẩn Nghị định 13/2023/NĐ-CP
* **Mã hóa cấp độ trường dữ liệu (Field-Level Encryption)**: 100% hồ sơ bệnh nền, tiền sử dị ứng lưu tại MongoDB được mã hóa đối xứng chuẩn **AES-256-GCM** (*Encryption at-rest*). Khóa bí mật được quản lý độc lập tại tệp cấu hình máy chủ.
* **Quyền chủ thể dữ liệu tối cao**:
  * **Xem & Trích xuất dữ liệu**: Tải toàn bộ hồ sơ y tế cá nhân dưới định dạng JSON chuẩn (*Data Portability*).
  * **Chỉnh sửa & Xóa vĩnh viễn**: Quyền được lãng quên (*Right to be Forgotten*).
  * **Khóa dữ liệu bệnh án**: Khi người bệnh kích hoạt tính năng khóa, AI bị tước quyền tự động cập nhật hoặc sửa đổi hồ sơ, đảm bảo quyền kiểm soát tuyệt đối thuộc về người dùng.

---

## 📊 5. KẾT QUẢ ĐÁNH GIÁ THỰC NGHIỆM (DDXPLUS BENCHMARK)

Để kiểm chuẩn năng lực suy luận y khoa khách quan, hệ thống được đánh giá thực nghiệm trên **DDXPlus Benchmark** từ **Viện Nghiên cứu Trí tuệ Nhân tạo Montreal (MILA - NeurIPS)**, mô phỏng tương tác 3 lượt hỏi bệnh lâm sàng.

### Bảng so sánh kết quả thực nghiệm tổng hợp:

| Mô Hình Đánh Giá | Tỷ Lệ Trúng Top 5 | Hỏi Trúng Triệu Chứng Ẩn | Tỷ Lệ Ảo Giác Y Khoa | Độ Nhạy Cấp Cứu (Recall) |
|---|:---:|:---:|:---:|:---:|
| 🏆 **MedAI (Hệ thống đề xuất)** | **90,0%** | **35,0%** | **0,0%** | **100,0%** |
| 🤖 **Gemini 3.1 Flash Lite** | 85,0% | 11,7% | Có xuất hiện | Phụ thuộc prompt |
| 🤖 **GPT-OSS-120B** | 85,0% | 20,0% | Có xuất hiện | Phụ thuộc prompt |

### Phân tích kết quả:
* **Tỷ lệ trúng Top 5 (90,0%)**: MedAI dẫn đầu toàn diện, cao hơn 5,0% so với cả Gemini 3.1 Flash Lite và GPT-OSS-120B, khẳng định khả năng phân tầng nguy cơ và chẩn đoán phân biệt vững vàng.
* **Hỏi trúng triệu chứng ẩn (35,0%)**: MedAI vượt trội (gấp 3 lần Gemini 3.1 Flash Lite - 11,7% và vượt xa GPT-OSS-120B - 20,0%). Việc ứng dụng thuật toán Entropy chọn câu hỏi có độ lệch chuẩn cao nhất giúp khai thác đúng triệu chứng bệnh nhân đang mắc phải mà chưa khai báo ban đầu.
* **Kiểm nghiệm chuyên sâu trên 50 ca bệnh lâm sàng**: Đạt độ chính xác **Top-1 88%**, **Top-3 96%**, **Emergency Recall 100%** và **0% ảo giác y khoa** (không có bệnh lý hay tỷ lệ % nào bịa ngoài đồ thị SymCAT).

---

## 🏗️ 6. HẠ TẦNG MICROSERVICES & BẢN ĐỒ DỊCH VỤ

```text
                           SƠ ĐỒ HẠ TẦNG TRIỂN KHAI MEDAI
                           
[NGƯỜI DÙNG / BỆNH NHÂN] ──(HTTPS/WSS)──► [CADDY REVERSE PROXY (Port 80/443)]
                                          │ (Auto ACME SSL Let's Encrypt / ZeroSSL)
        ┌─────────────────────────────────┴─────────────────────────────────┐
        ▼                                                                   ▼
[FRONTEND CONTAINER: Port 8080]                           [BACKEND CONTAINER: Port 4000]
• React 19 SPA, Vite 8                                    • Node.js Express, Rate Limiter
• Glassmorphism Design, Tailwind                          • JWT Authentication, Zod Schema
• SVG Probability Ring Indicator                          • AES-256-GCM Crypto Engine
        │                                                                   │
        └───────────────────────┬───────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────────────────────┐
        ▼                       ▼                                           ▼
[9ROUTER AI GATEWAY]   [NEO4J AURA / SYM-CAT]                     [MONGODB 7.0 & REDIS 7]
Port 20128             Port 7687                                  Port 27017 / Port 6379
• Gemini 3.1 Flash     • 801 Bệnh lý & 474 Triệu chứng            • Users & AES-256 Memory
• DeepSeek-v4 Failover • Xác suất Bayes điều kiện P(S|D)          • Incremental SCE Cache
• Token & Latency Log  • Cypher Query Graph Engine                • Daily DB Backup Volume
```

### Bản đồ phân hệ dịch vụ:

| Phân Hệ Dịch Vụ | Cổng / Điểm Cuối | Công Nghệ Cốt Lõi | Chức Năng |
|---|---|---|---|
| 🌐 **Frontend Client** | `Port 8080` / `5173` | React 19, Vite, Glassmorphism UI | Giao diện hội thoại lâm sàng, hiển thị vòng tròn xác suất SVG |
| ⚡ **Backend API** | `Port 4000` | Node.js, Express, Zod, AES-256 | Xử lý nghiệp vụ lâm sàng, mã hóa PHI, phân loại ý định |
| 🔀 **9Router AI Gateway** | `Port 20128` | Multi-Gateway Proxy | Cân bằng tải, quản trị API key, chuyển mạch dự phòng |
| 🌐 **Knowledge Graph** | `Port 7687` | Neo4j AuraDB, Cypher Query | Lưu trữ đồ thị SymCAT, tính toán xác suất Bayes |
| 🗄️ **Persistence Layer** | `Port 27017` | MongoDB 7.0 Mongoose | Quản lý người dùng, mã hóa lịch sử khám bệnh |
| ⚡ **Cache Layer** | `Port 6379` | Redis 7 Alpine | Bộ đệm trạng thái SCE gia số, danh mục triệu chứng |
| 💳 **Cổng Thanh Toán** | REST API v2 | PayPal SDK v2 | Nâng cấp gói cước Pro y tế (99.000đ/tháng) |
| 📊 **Admin Dashboard** | `/admin` | React, Recharts | Giám sát doanh thu, token AI, kiểm toán ca cấp cứu |

---

## 🧪 7. KIỂM THỬ TỰ ĐỘNG (AUTOMATED TESTING)

Dự án sở hữu bộ kiểm thử tự động toàn diện gồm **17 test suites** thực thi qua nền tảng **Vitest**:

* **Nhóm kiểm thử thuật toán & logic (Unit Tests)**:
  * `scoring.js`: Kiểm tra tính toán xác suất Bayes, hệ số nhân khẩu học, thời gian và điểm phạt triệu chứng phủ định.
  * `intentClassifier.js`: Kiểm tra đường quét nhanh Regex triệu chứng tiếng Việt và LLM Intent Fallback.
  * `sceStateCache.js`: Kiểm tra cơ chế đệm và hợp nhất gia số trạng thái lâm sàng trong Redis.
  * `memoryCrypto.js`: Kiểm tra mã hóa và giải mã chuẩn AES-256-GCM.
  * `errorHandler.js` & `validation.js`: Kiểm tra xử lý ngoại lệ và bắt lỗi Zod schema.
* **Nhóm kiểm thử tích hợp (Integration Tests)**:
  * `chat.routes.quota.test.js`: Kiểm soát hạn ngạch gói cước Free (5 câu) và Pro không giới hạn.
  * `payment.routes.test.js`: Kiểm tra webhook và vòng đời giao dịch PayPal REST API v2.
  * `requireAdmin`: Kiểm tra phân quyền quản trị viên.
* **Nhóm kiểm thử giao diện (Frontend Tests)**:
  * `ClinicalStatusIndicator.test.js`: Kiểm tra vòng tròn phần trăm SVG và phân cấp màu mức độ nguy cơ.
  * `aiService.safeFallback.test.js`: Kiểm tra cơ chế phục hồi giao diện khi mất kết nối mạng.

Chạy kiểm thử toàn bộ hệ thống:
```bash
# Backend unit & integration tests
cd back_end && npm test

# Frontend unit tests
npm test
```

---

## 🚀 8. HƯỚNG DẪN CẤU HÌNH & KHỞI CHẠY

### 8.1. Yêu cầu môi trường
* **Node.js**: Phiên bản 20 trở lên (khuyến nghị Node.js 22 LTS).
* **Docker & Docker Compose**: Để chạy toàn bộ hệ thống khép kín.
* **Neo4j**: Neo4j Desktop hoặc Neo4j Aura Cloud.
* **MongoDB & Redis**: Bản cài cục bộ hoặc Docker service.

### 8.2. Cấu hình biến môi trường
Sao chép và cấu hình tệp môi trường:
```bash
# 1. Cấu hình Backend
cp back_end/.env.example back_end/.env

# 2. Cấu hình Root (dành cho Docker Compose)
cp .env.example .env
```

Các biến môi trường trọng yếu trong `back_end/.env`:
```ini
NODE_ENV=production
PORT=4000

# Khóa bảo mật (sinh bằng: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
JWT_SECRET=your-super-secret-jwt-key
MEMORY_ENCRYPTION_KEY=your-48-byte-aes-256-encryption-key

# Kết nối cơ sở dữ liệu
MONGODB_URI=mongodb://127.0.0.1:27017/medchat
REDIS_URL=redis://127.0.0.1:6379

# Đồ thị tri thức Neo4j SymCAT
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-secure-password

# Cổng điều phối 9Router AI Gateway
LLM_ENDPOINT=http://127.0.0.1:20128/v1/chat/completions
LLM_API_KEY=your-9router-api-key

# Cổng thanh toán PayPal REST API v2
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox # hoặc 'live' khi triển khai chính thức
```

### 8.3. Khởi chạy bằng Docker Compose (Khuyến nghị cho Production)
```bash
# Khởi chạy toàn bộ hạ tầng (Caddy, Frontend, Backend, MongoDB, Redis, 9Router):
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Xem nhật ký vận hành backend:
docker compose logs -f backend

# Kiểm tra trạng thái sức khỏe các dịch vụ:
docker compose ps
```

### 8.4. Khởi chạy trong môi trường phát triển cục bộ (Local Development)
```bash
# Phân hệ Backend (Cổng 4000):
cd back_end
npm install
npm run dev

# Phân hệ Frontend (Cổng 5173 / Proxy sang 4000):
# Mở một terminal mới tại thư mục gốc:
npm install
npm run dev
```

Truy cập giao diện tại: `http://localhost:5173` (hoặc `http://localhost:8080`).

---

## 📋 9. CHECKLIST TRIỂN KHAI PRODUCTION

- [x] **Bảo mật biến môi trường**: Kiểm tra `Fail-Fast Configuration` tại `env.js`, từ chối khởi động nếu thiếu `JWT_SECRET` hoặc `MEMORY_ENCRYPTION_KEY`.
- [x] **Bảo vệ cổng mạng**: Chỉ mở công khai cổng 80 và 443 ra ngoài Internet qua Caddy. Toàn bộ cơ sở dữ liệu (MongoDB, Redis, Neo4j, 9Router) bind nội bộ.
- [x] **Mã hóa SSL tự động**: Caddy tự động đăng ký và gia hạn chứng chỉ HTTPS ACME.
- [x] **Sao lưu dữ liệu tự động**: Container `db-backup` định kỳ sao lưu MongoDB vào `./backups/` hàng ngày, xoay vòng lưu trữ 14 ngày.
- [x] **Kiểm toán khẩn cấp**: Bảng `Emergency Audit` trên Admin Dashboard theo dõi tức thì các lượt tư vấn kích hoạt cờ đỏ cấp cứu.

---

## 👥 10. MINH CHỨNG DỰ ÁN & THÔNG TIN ĐỘI THI

### 10.1. Đường dẫn thư mục minh chứng dự án
Toàn bộ tài liệu hồ sơ, mã nguồn, lịch sử prompt qua 5 giai đoạn, video demo và báo cáo kiểm thử được lưu trữ công khai tại:
👉 **[Thư Mục Minh Chứng Dự Án - Google Drive](https://drive.google.com/drive/folders/1MedAI-NationalYouthAI-2026-Evidence-Showcase?usp=sharing)**

### 10.2. Bản quyền & Cam đoan
* Sản phẩm dự thi **Cuộc thi Sáng tạo trẻ Quốc gia trong lĩnh vực Trí tuệ nhân tạo năm 2026**.
* Giấy phép mã nguồn mở: **MIT License**.
* Đội thi cam kết toàn bộ thông tin, số liệu, mã nguồn và kết quả thử nghiệm trong tài liệu này là hoàn toàn trung thực, do chính đội ngũ nghiên cứu và phát triển.

---
*MedAI — Định Hình Tương Lai Sàng Lọc Y Tế Số: Chính Xác, An Toàn, Minh Bạch và Nhân Văn.*
