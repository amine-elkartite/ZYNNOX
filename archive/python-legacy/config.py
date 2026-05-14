"""Central settings for the AI data collection and fine-tuning project."""

from pathlib import Path


# Project paths are resolved relative to this file so the project can be moved
# without rewriting absolute paths in every module.
PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "knowledge_base.db"
QUESTIONS_PATH = DATA_DIR / "questions.txt"
PIPELINE_LOG_PATH = DATA_DIR / "pipeline.log"
DATASET_PATH = DATA_DIR / "dataset.json"
DATASET_TRAIN_PATH = DATA_DIR / "dataset_train.json"
DATASET_VAL_PATH = DATA_DIR / "dataset_val.json"
SCRAPING_LOG_PATH = DATA_DIR / "scraping.log"
SMART_INFERENCE_LOG_PATH = DATA_DIR / "smart_inference.log"
INFERENCE_STATS_PATH = DATA_DIR / "inference_stats.json"

# Legacy Python data utilities no longer connect to a local model runtime.
# The production AI provider is configured in server/src/config/env.js.
LEGACY_AI_MODEL_NAME = "zynnox-external-provider"
REQUEST_TIMEOUT_SECONDS = 60
REQUEST_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2

# Dataset generation and filtering defaults.
DEFAULT_TOPICS = [
    "science",
    "history",
    "coding",
    "mathematics",
    "philosophy",
    "general knowledge",
]
DEFAULT_QUESTION_COUNT = 200
MIN_ANSWER_LENGTH = 50
MAX_ANSWER_LENGTH = 2000
MIN_EXPORT_SCORE = 0.5
RANDOM_SEED = 42

# Hugging Face / PEFT / LoRA settings.
BASE_MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
OUTPUT_DIR = PROJECT_ROOT / "my_model"
FINAL_MODEL_DIR = OUTPUT_DIR / "final"
LORA_R = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.05
LORA_TARGET_MODULES = ["q_proj", "v_proj"]
NUM_TRAIN_EPOCHS = 3
PER_DEVICE_TRAIN_BATCH_SIZE = 4
LEARNING_RATE = 2e-4
SAVE_STEPS = 100
LOGGING_STEPS = 10
MAX_SEQ_LENGTH = 512
MAX_NEW_TOKENS = 256

# Web collection settings. These defaults intentionally favor polite crawling
# over raw speed because the collected data is meant for reusable training.
WEB_SEARCH_MAX_RESULTS = 10
WEB_SEARCH_DELAY_SECONDS = 2
SCRAPER_TIMEOUT_SECONDS = 10
PAGE_DELAY_RANGE_SECONDS = (1, 3)
DOMAIN_DELAY_SECONDS = 10
MAX_PAGES_PER_DOMAIN = 100
TARGET_LANGUAGE = "en"
MIN_CONTENT_WORDS = 100
DEDUPLICATION_THRESHOLD = 0.8
MINHASH_NUM_PERMUTATIONS = 128
SCRAPER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36 ai-moodele-research-bot/1.0"
)
BLACKLISTED_DOMAINS = [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "linkedin.com",
]
DEFAULT_REDDIT_SUBREDDITS = [
    "explainlikeimfive",
    "science",
    "programming",
    "askscience",
]
DEFAULT_NEWS_FEEDS = [
    "http://feeds.bbci.co.uk/news/rss.xml",
    "https://feeds.reuters.com/reuters/topNews",
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
]
COMMON_CRAWL_INDEX_URL = "http://index.commoncrawl.org/"
COMMON_CRAWL_COLLINFO_URL = "http://index.commoncrawl.org/collinfo.json"
WEB_QA_MODEL_NAME = f"{LEGACY_AI_MODEL_NAME}-web-qa"
WEB_QA_PROMPT_TEMPLATE = """Read this text and generate 5 question-answer pairs from it.
Format each pair exactly as:
Q: ...
A: ...

Text:
{content}
"""

# Smart inference settings.
WEB_FALLBACK_RESULTS = 3
ANSWER_CONTEXT_MAX_CHARS = 12000
LOCAL_CONFIDENCE_MIN_CHARS = 30
RETRAIN_THRESHOLD = 50
RETRAIN_INTERVAL_HOURS = 24
AUTO_LEARN_QUALITY_SCORE = 0.8
WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"


def ensure_directories() -> None:
    """Create project output directories before modules write data or models."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
