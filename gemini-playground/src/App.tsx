import { useState } from "react";
import GeminiExperiment from "./experiments/gemini/GeminiExperiment";
import MorphologicalExperiment from "./experiments/morphological/MorphologicalExperiment";
import WordMeaningExperiment from "./experiments/word-meaning/WordMeaningExperiment";
import EnsembleExperiment from "./experiments/ensemble/EnsembleExperiment";
import PromptEvalExperiment from "./experiments/prompt-eval/PromptEvalExperiment";
import "./App.css";

const TranslationEval = () => <PromptEvalExperiment mode="translation" />;
const WordMeaningEval = () => <PromptEvalExperiment mode="wordMeaning" />;

const EXPERIMENTS = [
  { id: "translation-eval", label: "Translation Eval", component: TranslationEval },
  { id: "word-meaning-eval", label: "Word Meaning Eval", component: WordMeaningEval },
  { id: "gemini", label: "Gemini Translation", component: GeminiExperiment },
  { id: "morphological", label: "Morphological Analysis", component: MorphologicalExperiment },
  { id: "word-meaning", label: "Word Meaning", component: WordMeaningExperiment },
  { id: "ensemble", label: "Ensemble", component: EnsembleExperiment },
] as const;

const STORAGE_KEY_TAB = "playground-active-tab";

export default function App() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(STORAGE_KEY_TAB) ?? "morphological"
  );

  const switchTab = (id: string) => {
    setActiveTab(id);
    localStorage.setItem(STORAGE_KEY_TAB, id);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Experiment Playground</h1>
        <div className="tab-bar">
          {EXPERIMENTS.map((exp) => (
            <button
              key={exp.id}
              className={`tab-btn${activeTab === exp.id ? " active" : ""}`}
              onClick={() => switchTab(exp.id)}
            >
              {exp.label}
            </button>
          ))}
        </div>
      </div>
      {EXPERIMENTS.map((exp) => (
        <div key={exp.id} style={{ display: activeTab === exp.id ? "block" : "none" }}>
          <exp.component />
        </div>
      ))}
    </div>
  );
}
