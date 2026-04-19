"""Scraping Providers Manager – Handles external scrapers with dynamic API keys."""
import requests
from abc import ABC, abstractmethod

class ScrapingProvider(ABC):
    @abstractmethod
    def fetch(self, url, options=None):
        pass

class ScrapingBeeProvider(ScrapingProvider):
    def __init__(self, api_key):
        self.api_key = api_key
        self.endpoint = "https://app.scrapingbee.com/api/v1/"

    def fetch(self, url, options=None):
        params = {
            "api_key": self.api_key,
            "url": url,
            "render_js": "true",
            "premium_proxy": "true"
        }
        resp = requests.get(self.endpoint, params=params, timeout=60)
        resp.raise_for_status()
        return resp.text

class ScraperAPIProvider(ScrapingProvider):
    def __init__(self, api_key):
        self.api_key = api_key
        self.endpoint = "http://api.scraperapi.com/"

    def fetch(self, url, options=None):
        params = {
            "api_key": self.api_key,
            "url": url,
            "render": "true",
            "premium": "true"
        }
        resp = requests.get(self.endpoint, params=params, timeout=60)
        resp.raise_for_status()
        return resp.text

class BrightDataProvider(ScrapingProvider):
    def __init__(self, host, port, username, password):
        self.proxies = {
            "http": f"http://{username}:{password}@{host}:{port}",
            "https": f"http://{username}:{password}@{host}:{port}",
        }

    def fetch(self, url, options=None):
        resp = requests.get(url, proxies=self.proxies, timeout=60, verify=False)
        resp.raise_for_status()
        return resp.text

class ProviderManager:
    def __init__(self, config=None):
        """
        config: dict containing provider details, e.g.
        {'name': 'scrapingbee', 'apiKey': '...'}
        """
        self.config = config or {}
        self.provider = None
        
        name = self.config.get("name")
        key = self.config.get("apiKey")
        
        if name == "scrapingbee":
            self.provider = ScrapingBeeProvider(key)
        elif name == "scraperapi":
            self.provider = ScraperAPIProvider(key)
        elif name == "brightdata":
            # For BrightData, key might be 'host:port:user:pass'
            parts = key.split(":")
            if len(parts) == 4:
                self.provider = BrightDataProvider(*parts)

    def fetch(self, url):
        if not self.provider:
            return None # Fallback to internal
        
        try:
            return self.provider.fetch(url)
        except Exception as e:
            print(f"[PROVIDER] {self.config.get('name')} failed: {e}")
            return None
