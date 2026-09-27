# 🧪 MedAI Clinical Diagnostic Benchmark (DDXPlus Interactive)

Thư mục này chứa bộ công cụ và dữ liệu kiểm chuẩn (**Benchmark Harness**) để đo lường định lượng độ chính xác chẩn đoán lâm sàng tương tác đa vòng (**Interactive Active Questioning**) giữa hệ thống **MedAI** và các mô hình ngôn ngữ lớn hàng đầu (**Gemini 3.1 Flash Lite**, **GPT-OSS-120B**).

---

## 1. Cấu trúc thư mục chuẩn hóa

```text
medchat/benchmark/
├── data/
│   ├── ddxplus_100_cases.json               # 100 ca lâm sàng chuẩn hóa theo DDXPlus Benchmark (9 chuyên khoa)
│   ├── symcat_graph.json                    # Snapshot đồ thị tri thức SymCAT (801 bệnh, 474 triệu chứng)
│   ├── .cache_interactive_ddxplus_gemini.json # Cache kết quả phiên khám tương tác của Gemini
│   └── .cache_interactive_ddxplus_gpt120b.json# Cache kết quả phiên khám tương tác của GPT-120B
├── run_benchmark.js                         # Script Node.js thực thi phiên khám tương tác cho cả 3 mô hình
├── REPORT.md                                # Báo cáo kết quả tổng hợp chính thức
└── README.md                                # Tài liệu hướng dẫn phương pháp luận & tái lập thực nghiệm
```

---

## 2. Hướng dẫn chạy Benchmark

Mở terminal tại thư mục `medchat`:

```bash
# 1. Chạy đánh giá cho MedAI (thuần thuật toán Bayesian & Information Gain)
node benchmark/run_benchmark.js medai

# 2. Chạy đánh giá cho Gemini 3.1 Flash Lite
node benchmark/run_benchmark.js gemini

# 3. Chạy đánh giá cho GPT-OSS-120B
node benchmark/run_benchmark.js gpt120b

# 4. Chạy toàn bộ 3 mô hình và in bảng tổng hợp
node benchmark/run_benchmark.js
```

---

## 3. Xem báo cáo chi tiết

Báo cáo kết quả đo đạc chính thức được lưu tại: [`benchmark/REPORT.md`](./REPORT.md).
