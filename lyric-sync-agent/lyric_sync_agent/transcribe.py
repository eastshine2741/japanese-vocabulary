from pathlib import Path

from faster_whisper import WhisperModel, decode_audio

from .align import Word

SAMPLE_RATE = 16000


class Transcriber:
    def __init__(self, model_name: str, device: str):
        self.model = WhisperModel(model_name, device=device, compute_type="int8_float16" if device == "cuda" else "int8")

    def full(self, vocals: Path) -> list[Word]:
        segments, _ = self.model.transcribe(
            str(vocals),
            language="ja",
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )
        return [Word(float(w.start), float(w.end), w.word) for s in segments for w in (s.words or [])]

    def window(self, audio, start: float, end: float, prompt: str) -> list[Word]:
        """Re-listens to one stretch with the lyrics expected there as the prompt, so Whisper hears those words.

        VAD and previous-text conditioning are off: on the full pass they are what dropped whole verses.
        """
        start = max(0.0, start)
        clip = audio[int(start * SAMPLE_RATE):int(end * SAMPLE_RATE)]
        segments, _ = self.model.transcribe(
            clip,
            language="ja",
            word_timestamps=True,
            initial_prompt=prompt,
            condition_on_previous_text=False,
            vad_filter=False,
        )
        return [Word(start + float(w.start), start + float(w.end), w.word) for s in segments for w in (s.words or [])]

    @staticmethod
    def load(vocals: Path):
        return decode_audio(str(vocals), sampling_rate=SAMPLE_RATE)
