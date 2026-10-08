# PRD — Shadowing Language Learning Web

Phần 1–12 là PRD gốc của MVP. MVP đã được làm trong app. Việc kế tiếp là thay transcript giả của Bài 16 bằng script và timestamp nghe từ audio. Làm theo **mục 13**, không làm lại player.

## 1. Product Overview

Xây dựng một web app hỗ trợ học ngoại ngữ bằng phương pháp **shadowing**.

Người học nghe audio, theo dõi script tương ứng và luyện nói lại theo từng câu hoặc từng đoạn ngắn. Mục tiêu chính là giúp người học dễ dàng:

- nghe lại một câu nhiều lần;
- tua chính xác đến đoạn audio tương ứng với câu đang học;
- theo dõi script đồng bộ với audio;
- luyện ở tốc độ chậm hoặc nhanh hơn;
- sau này có thể tạo lesson từ audio/script của riêng mình.

Phiên bản đầu tiên chỉ cần phục vụ **personal use / local development** và có thể deploy dưới dạng static web trên GitHub Pages.

---

## 2. Core Use Case

Một lesson gồm:

- một file audio;
- một script được chia thành các câu hoặc đoạn;
- mỗi câu được map tới một khoảng thời gian trong audio.

Ví dụ:

```ts
{
  id: "sentence-1",
  text: "I think this is a really good idea.",
  start: 3.82,
  end: 6.91
}
```

Khi người dùng click vào câu:

1. audio seek tới `start`;
2. bắt đầu phát;
3. dừng hoặc loop khi đến `end`;
4. UI highlight câu đang được phát.

---

## 3. MVP Scope

### Lesson

MVP sử dụng dữ liệu hard-code.

Mỗi lesson gồm:

- audio file local/static;
- transcript;
- các segment với `start` và `end`.

Chưa cần:

- account;
- backend;
- database;
- upload;
- YouTube;
- auto transcription;
- AI alignment.

---

### Audio Player

Cần hỗ trợ:

- play / pause;
- seek;
- playback speed;
- phát một khoảng `start → end`;
- replay segment hiện tại;
- loop segment;
- previous / next segment.

Playback speed tối thiểu:

- 0.5x
- 0.75x
- 1x
- 1.25x

---

### Transcript

Script được chia thành các segment.

UI cần:

- hiển thị toàn bộ script;
- highlight segment đang phát;
- click segment để phát đúng đoạn audio;
- tự scroll tới segment active nếu cần.

Segment là đơn vị chính của MVP.

Không cần word-level synchronization trong phiên bản đầu.

---

### Waveform

Hiển thị waveform của audio để:

- nhìn trực quan vị trí hiện tại;
- seek;
- xem segment tương ứng với transcript.

Technical direction ưu tiên **WaveSurfer.js**.

Có thể sử dụng:

- waveform;
- Timeline plugin;
- Regions plugin.

MVP chưa cần editor hoàn chỉnh kiểu Audacity.

---

## 4. Authoring Direction

Trong MVP, timing được hard-code thủ công.

Tuy nhiên data model cần chuẩn bị cho khả năng sau này có một authoring UI.

Workflow tương lai:

1. nhập hoặc paste script;
2. chia thành sentence/segment;
3. chọn một sentence;
4. xác định `start` và `end` trên waveform;
5. chỉnh hai đầu region để fine-tune;
6. lưu lesson.

Có thể hỗ trợ keyboard workflow để đánh dấu nhanh:

- chọn sentence;
- play audio;
- mark start;
- mark end;
- chuyển sang sentence tiếp theo.

Mục tiêu là nhanh hơn việc drag region hoàn toàn bằng chuột.

---

## 5. Data Model

Data model nên độc lập với audio library.

```ts
type Lesson = {
  id: string
  title: string
  audio: AudioSource
  segments: Segment[]
}

type AudioSource =
  | {
      type: "file"
      src: string
    }
  | {
      type: "youtube"
      videoId: string
    }

type Segment = {
  id: string
  text: string
  start: number
  end: number
  words?: WordTiming[]
}

type WordTiming = {
  text: string
  start: number
  end: number
}
```

Trong MVP chỉ sử dụng:

```ts
AudioSource.type = "file"
```

`words` là optional để phục vụ future word-level synchronization.

---

## 6. Word-level Highlighting

Không nằm trong MVP.

Sentence-level timing:

```text
start ---------------- end
        sentence
```

không đủ thông tin để highlight chính xác từng word.

Word-level highlighting yêu cầu timing dạng:

```ts
[
  { text: "I", start: 1.20, end: 1.31 },
  { text: "think", start: 1.32, end: 1.68 }
]
```

Hướng phát triển sau này:

1. speech-to-text / forced alignment tự sinh word timings;
2. author review và chỉnh những chỗ sai;
3. UI highlight word theo current audio time.

Không nên bắt user manually mark từng word.

---

## 7. Technical Direction

### Frontend

Ưu tiên:

- React
- TypeScript
- static deployment

Không cần framework/backend phức tạp trong MVP.

---

### Audio / Waveform

Ưu tiên:

**WaveSurfer.js v7**

Lý do:

- waveform;
- seek;
- playback control;
- timeline;
- regions;
- phù hợp với use case audio annotation;
- có thể tích hợp tốt với React.

Không cần thêm Howler.js trong MVP.

---

### Player Abstraction

Business logic không nên phụ thuộc trực tiếp vào WaveSurfer.

Có thể giữ một abstraction đơn giản:

```ts
interface AudioPlayer {
  play(): void
  pause(): void
  seek(time: number): void
  getCurrentTime(): number
  playRange(start: number, end: number): void
  setPlaybackRate(rate: number): void
}
```

MVP implementation:

```text
WaveSurferPlayer
```

Future:

```text
YouTubePlayer
```

Mục đích là cho phép transcript và lesson logic hoạt động độc lập với audio source.

---

## 8. UI Direction

Layout cơ bản:

```text
┌──────────────────────────────────────────┐
│ Play / Pause   Speed   Current Time      │
│                                          │
│            Audio Waveform                │
│            + Timeline                    │
└──────────────────────────────────────────┘

Transcript

▶ Sentence 1
  Sentence 2
  Sentence 3
  Sentence 4
```

Interaction chính:

- click waveform → seek;
- click sentence → play segment;
- audio chạy → highlight current sentence;
- replay → phát lại sentence hiện tại;
- next / previous → chuyển sentence;
- loop → luyện một sentence liên tục.

UI ưu tiên nhanh, ít thao tác và phục vụ việc luyện tập hơn là editing.

---

## 9. Shadowing-focused UX

Các action quan trọng nhất:

- Replay current sentence
- Previous sentence
- Next sentence
- Toggle loop
- Change playback speed
- Play / pause

Nên hỗ trợ keyboard shortcut để user có thể luyện mà không cần dùng chuột liên tục.

Exact shortcut có thể quyết định trong implementation.

---

## 10. Deployment

MVP deploy dạng static site trên GitHub Pages.

Repository chứa:

```text
src/
public/
  audio/
    lesson-01.mp3

lessons/
  lesson-01.json
```

Audio hard-code trong repository chỉ phù hợp cho prototype.

Khi có nhiều lesson hoặc external users, audio nên chuyển sang object storage/CDN.

---

## 11. Future Scope

Không implement trong MVP nhưng architecture không nên chặn các hướng sau:

### User-created lessons

User có thể:

- upload audio;
- paste script;
- tạo segment;
- chỉnh timing;
- lưu lesson.

### YouTube

User nhập YouTube URL.

Sử dụng YouTube player thay cho WaveSurfer audio player.

Segment model `{ start, end }` vẫn giữ nguyên.

### Automatic alignment

Tự động:

- transcribe audio;
- align script với audio;
- generate sentence timings;
- generate word timings.

User chỉ cần review và sửa.

### Karaoke-style word highlighting

Highlight word theo audio timeline.

### Persistence

Có thể tiến dần:

```text
hard-coded data
→ localStorage / IndexedDB
→ backend/database
```

Không cần backend trước khi product workflow được validate.

---

## 12. MVP Success Criteria

MVP được xem là thành công nếu user có thể:

1. mở một lesson;
2. nghe audio;
3. đọc transcript;
4. click một sentence và nghe đúng đoạn tương ứng;
5. replay / loop sentence nhanh;
6. điều chỉnh playback speed;
7. di chuyển qua lại giữa các sentence;
8. luyện shadowing thuận tiện hơn so với sử dụng audio player thông thường.

Mục tiêu của MVP không phải xây một language learning platform hoàn chỉnh.

Mục tiêu là validate **core shadowing workflow** trước khi đầu tư vào authoring, synchronization automation hoặc user-generated content.

---

## 13. Tạo data Bài 16 từ audio

Đây là việc kế tiếp. Chỉ thay `segments` trong `src/data/shadowing/lesson-01.ts`. Giữ nguyên `id: 'lesson-01'`, `title: 'Bài 16'`, `audio.src: 'audio/shadowing/bai-16.mp3'`. Không sửa player, UI, hay type. Không thêm `words` (word-level timing). Không commit trừ khi được hỏi.

### Audio

- File app đang phát: `public/audio/shadowing/bai-16.mp3`
- Thời lượng: **303.23 giây** (ffprobe).
- Bản gốc người dùng đưa: `Bài 16 Hán ngữ 2.mp3` trong thư mục nghe CB2.
- `src/data/lessons/bai-16.txt` là **bảng từ** (`chữ | pinyin | nghĩa`), không phải lời thoại. Dùng để đối chiếu từ khó và chính tả. Không chép file đó thành các câu.

40 câu `这是第N句。` đang chia đều 300 giây là placeholder để thử scroll. Xóa hết. Số câu thật do audio quyết định.

Từ đã lưu trỏ `segmentId` kiểu `s2`. Sau khi thay placeholder, `s2` sẽ là câu nói thứ hai, không còn là câu giả. Đó là việc đúng. Không giữ câu giả để bảo vệ id cũ.

### Một segment là gì

Một câu, hoặc một lượt nói, mà người học shadow trong một hơi.

- Có `。？！` ở giữa một đoạn whisper thì tách thành hai segment.
- Whisper cắt đôi một câu thì gộp lại.
- Hai người nói, có khoảng dừng rõ, thì mỗi lượt là một segment.
- Bỏ nhạc, tiếng lật trang, và im lặng. Im lặng trước câu đầu là khoảng trống, không phải một segment. Player đã highlight câu 1 khi thời gian còn trước `start` của câu đó.
- Không thêm nhãn người nói (`A:`, `男:`) nếu audio không đọc nhãn đó. Type không có field speaker.

### Field

```ts
{
  id: 's1',              // s1, s2, … theo thứ tự nói. Duy nhất. Không nhảy số.
  text: '现在咱们一起走吧。', // giản thể, đúng chữ đã nói, dấu câu Trung (。？！，)
  pinyin: 'xiànzài zánmen yìqǐ zǒu ba', // thanh bằng dấu, cách từng âm tiết
  meaning: 'Bây giờ chúng ta cùng đi thôi.', // một câu tiếng Việt tự nhiên
  start: 12.4,           // giây, 2 chữ số thập phân
  end: 15.05,
}
```

`text`

- Luôn giản thể. App lưu từ và tô chữ đã lưu bằng giản thể. Phồn thể chỉ là lớp hiển thị.
- Số viết theo cách chữ viết của bài (chữ Hán hoặc chữ số) đúng với điều đã nói, không để số Ả Rập nếu audio đọc bằng chữ.
- Không nhét pinyin vào `text`.

`pinyin`

- Dấu thanh (`nǐ`), không số thanh (`ni3`). Dòng này hiện nguyên dưới câu.
- Cách âm tiết. Thanh nhẹ không dấu (`ba`, `shíhou`), cùng kiểu `src/data/lessons/bai-16.txt`.
- `ü`, không viết `v`.

`meaning`

- Nghĩa cả câu, không phải glos từng chữ.
- Không đưa chú thích ngữ pháp (`# …` trong file từ) vào đây.

`start` / `end` — `validateLesson` trong `src/shadowing/segments.ts` từ chối lesson nếu sai:

- `end > start`, `start >= 0`
- xếp theo thời gian, không chồng: `start` của câu sau `>= end` của câu trước (chạm nhau thì được)
- `text` không rỗng, `id` không trùng

Quy tắc nghe, chặt hơn validator:

- Chừa khoảng **0.08–0.15 giây** trước âm đầu và sau âm cuối, để không cụt tiếng.
- Khoảng đệm không được lấn âm đầu của câu sau. Hai câu sát nhau thì đặt mốc ở giữa khoảng dừng, không chồng.
- Đừng kéo câu cuối tới 303.23 nếu phần cuối là im lặng.
- Khoảng dừng giữa hai câu là gap. Player highlight câu trước trong gap. Không cần bịt gap.

### Cách lấy timestamp cho đúng

Đừng ước lượng bằng cách chia đều file.

1. Chạy speech-to-text có timestamp, tiếng Trung. Ví dụ nếu có whisper:

   ```bash
   whisper "public/audio/shadowing/bai-16.mp3" \
     --language zh --model medium \
     --output_format json --word_timestamps True
   ```

   Kết quả chỉ là bản nháp. Whisper hay nhầm từ đồng âm.

2. Sửa chữ bằng tai, và đối chiếu từ khả nghi với `src/data/lessons/bai-16.txt`. Không ép mọi từ trong bảng từ phải xuất hiện trong hội thoại.

3. Cắt từng đoạn bằng ffmpeg (cắt lại, không `-c copy`, vì copy seek lệch):

   ```bash
   ffmpeg -ss START -to END -i public/audio/shadowing/bai-16.mp3 -vn /tmp/seg.wav
   ```

   Nghe ít nhất: 3 câu đầu, 1 câu giữa, 1 câu rất ngắn, và câu cuối. Âm đầu phải nằm trong đoạn. Âm đầu của câu sau phải nằm ngoài đoạn.

4. `npm test` phải qua. Test `bundled shadowing lessons` gọi `validateLesson` cho mọi lesson.

Không đánh dấu từng chữ. App tô từ đã lưu bằng cách tìm chuỗi Hán tự trong câu, không dùng `words`.
