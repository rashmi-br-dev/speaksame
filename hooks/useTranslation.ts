"use client";

import { useRef, useState, useCallback } from "react";

interface TranslationState {
  transcript: string;
  translated: string;
  detectedLanguage: string;
  targetLanguage: string;
  isListening: boolean;
  isProcessing: boolean;
}

export const useTranslation = () => {
  const [state, setState] = useState<TranslationState>({
    transcript: "",
    translated: "",
    detectedLanguage: "EN",
    targetLanguage: "NONE",
    isListening: false,
    isProcessing: false
  });

  const recognitionRef = useRef<any>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const startListening = useCallback(async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, isProcessing: false }));
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setState(prev => ({
          ...prev,
          transcript: finalTranscript,
          isProcessing: true
        }));
        
        // Trigger translation
        translateText(finalTranscript, state.detectedLanguage, state.targetLanguage);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [state.detectedLanguage, state.targetLanguage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, []);

  const translateText = useCallback(async (text: string, from: string, to: string) => {
    if (!text || from === to || to === "NONE") {
      setState(prev => ({ ...prev, translated: "", isProcessing: false }));
      return;
    }

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          from,
          to,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        translated: data.translatedText,
        isProcessing: false
      }));
    } catch (error) {
      console.error('Translation error:', error);
      setState(prev => ({ ...prev, translated: "", isProcessing: false }));
    }
  }, []);

  const speakTranslation = useCallback(() => {
    if (!state.translated || !('speechSynthesis' in window)) {
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(state.translated);
    utterance.lang = getLanguageCode(state.targetLanguage);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [state.translated, state.targetLanguage]);

  const copyTranslation = useCallback(() => {
    if (state.translated) {
      navigator.clipboard.writeText(state.translated);
    }
  }, [state.translated]);

  const setTargetLanguage = useCallback((language: string) => {
    setState(prev => ({ ...prev, targetLanguage: language }));
  }, []);

  const reset = useCallback(() => {
    setState({
      transcript: "",
      translated: "",
      detectedLanguage: "EN",
      targetLanguage: state.targetLanguage,
      isListening: false,
      isProcessing: false
    });
  }, [state.targetLanguage]);

  return {
    ...state,
    startListening,
    stopListening,
    speakTranslation,
    copyTranslation,
    setTargetLanguage,
    reset,
    translateText
  };
};

function getLanguageCode(language: string): string {
  const codes: Record<string, string> = {
    'EN': 'en-US',
    'ES': 'es-ES',
    'FR': 'fr-FR',
    'DE': 'de-DE',
    'IT': 'it-IT',
    'PT': 'pt-PT',
    'RU': 'ru-RU',
    'JA': 'ja-JP',
    'KO': 'ko-KR',
    'ZH': 'zh-CN',
    'AR': 'ar-SA',
    'HI': 'hi-IN'
  };
  return codes[language] || 'en-US';
}
