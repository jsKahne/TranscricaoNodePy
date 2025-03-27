import sys
import json
import logging
import whisper
from datetime import datetime
from pathlib import Path
from text_processor import TextProcessor, TextProcessingRules

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Forçar stdout para usar UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def basic_text_processor():
    """Cria um processador de texto com regras básicas"""
    rules = TextProcessingRules(
        # Apenas ajustes essenciais
        capitalize_sentences=True,  # Capitaliza início de frases
        fix_spaces=True,           # Remove espaços duplos
        ensure_final_punctuation=True,  # Garante pontuação final
        normalize_numbers=False,    # Mantém números como estão
        fix_common_errors=False,    # Não corrige gírias/abreviações
        normalize_punctuation=True, # Apenas ajusta espaços na pontuação
        # Lista mínima de palavras para capitalizar
        capitalize_words=['Brasil', 'São Paulo', 'Rio de Janeiro'],
        # Sem substituições de palavras
        common_replacements={}
    )
    return TextProcessor(rules)

def transcribe_audio(audio_path):
    try:
        # Usar processador básico
        text_processor = basic_text_processor()
        
        logger.info("Loading Whisper model...")
        model = whisper.load_model("base")
        
        logger.info(f"Starting transcription of {audio_path}")
        result = model.transcribe(
            audio_path,
            language="pt",
            initial_prompt="Transcreva em português do Brasil. Mantenha o estilo natural da fala:"
        )
        
        # Aplicar apenas processamento básico
        text = text_processor.process(result["text"])
        
        logger.info("Transcription completed successfully")
        
        # Retornar resultado como JSON usando UTF-8
        return json.dumps({
            "status": "success",
            "text": text,
            "language": result.get("language", "pt")
        }, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Error during transcription: {str(e)}")
        return json.dumps({
            "status": "error",
            "error": str(e)
        }, ensure_ascii=False)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({
            "status": "error",
            "error": "Please provide the audio file path"
        }, ensure_ascii=False))
        sys.exit(1)
        
    audio_path = sys.argv[1]
    print(transcribe_audio(audio_path))
