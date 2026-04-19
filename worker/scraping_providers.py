"""Scraping Providers Manager – Handles external API scrapers like ScrapingBee and ScraperAPI."""
import os
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
        print(f"[PROVIDER] ScrapingBee fetching: {url}")
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
        print(f"[PROVIDER] ScraperAPI fetching: {url}")
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
        print(f"[PROVIDER] BrightData fetching: {url}")
        resp = requests.get(url, proxies=self.proxies, timeout=60, verify=False)
        resp.raise_for_status()
        return resp.text

class ProviderManager:
    def __init__(self):
        self.primary_provider_name = os.environ.get("SCRAPING_PROVIDER", "internal")
        
        # Initialize providers from ENV
        self.providers = {}
        
        bee_key = os.environ.get("SCRAPINGBEE_API_KEY")
        if bee_key:
            self.providers["scrapingbee"] = ScrapingBeeProvider(bee_key)
            
        sapi_key = os.environ.get("SCRAPERAPI_API_KEY")
        if sapi_key:
            self.providers["scraperapi"] = ScraperAPIProvider(sapi_key)
            
        bd_host = os.environ.get("BRIGHTDATA_HOST")
        if bd_host:
            self.providers["brightdata"] = BrightDataProvider(
                bd_host,
                os.environ.get("BRIGHTDATA_PORT", "22225"),
                os.environ.get("BRIGHTDATA_USERNAME"),
                os.environ.get("BRIGHTDATA_PASSWORD")
            )

    def fetch(self, url, provider_name=None):
        """Fetch HTML content using the specified or default provider with fallback."""
        target_provider = provider_name or self.primary_provider_name
        
        if target_provider == "internal":
            return None # Signal to use internal Scrapy/Playwright
            
        # Try requested provider
        try:
            if target_provider in self.providers:
                return self.providers[target_provider].fetch(url)
        except Exception as e:
            print(f"[PROVIDER] Requested provider {target_provider} failed: {e}")

        # Fallback logic: scrapingbee -> scraperapi -> internal
        for fallback in ["scrapingbee", "scraperapi"]:
            if fallback == target_provider: continue
            if fallback in self.providers:
                try:
                    print(f"[PROVIDER] Falling back to {fallback}")
                    return self.providers[fallback].fetch(url)
                except Exception as fe:
                    print(f"[PROVIDER] Fallback {fallback} failed: {fe}")
                    
        print("[PROVIDER] All external providers failed or unavailable, falling back to internal")
        return None
