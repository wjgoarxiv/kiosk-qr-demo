# 제3자 코드 고지

## qr-encoder.js — QRCode for JavaScript (Kazuhiko Arase)

- 원본: Kazuhiko Arase, "QRCode for JavaScript", http://www.d-project.com/ (MIT License).
- 입수 경로: 이 컴퓨터에 설치된 qrcode-terminal 0.12.0의 `vendor/QRCode/*.js`(Node용으로 정리된 사본). 새로 내려받지 않았다.
- 가공: `tools/vendor_qr.mjs`가 파일 10개를 내용 변경 없이 한 ES 모듈로 묶고 `qrMatrix(text)`와 ASCII 전용 검사만 더했다.
- "QR Code"는 DENSO WAVE INCORPORATED의 등록상표다.
- 원본 파일 해시는 증거 폴더의 `T2-qr-vendor.json`에 있다.

MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## fonts/ — Pretendard

SIL Open Font License 1.1. 전문은 `../fonts/OFL.txt`. 이전 작업의 사본을 해시 동일하게 복사했다.
