"""Generic Spider – Configurable spider driven by session parameters."""
import scrapy
from scrapy_playwright.page import PageMethod


class GenericSpider(scrapy.Spider):
    """A dynamic spider that configures itself from session parameters.

    Accepts:
        start_url:  The URL to begin scraping.
        selectors:  Dict of CSS selectors to extract data, e.g.
                    {"title": "h1::text", "price": ".price::text"}
        pagination: Dict with optional keys:
                    - "selector": CSS selector for the next-page link
                    - "max_pages": Maximum number of pages to follow
        job_id:     SpiderFlow job ID for tracking.
        session_id: SpiderFlow session ID.
        user_id:    Owner user ID.
    """

    name = "generic"

    def __init__(
        self,
        start_url: str = "",
        selectors: dict = None,
        pagination: dict = None,
        job_id: str = "",
        session_id: str = "",
        user_id: str = "",
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.start_urls = [start_url] if start_url else []
        self.selectors = selectors or {}
        self.pagination = pagination or {}
        self.job_id = job_id
        self.session_id = session_id
        self.user_id = user_id
        self.pages_scraped = 0
        self.max_pages = int(self.pagination.get("max_pages", 50))

    def start_requests(self):
        """Yield initial requests with Playwright for JS rendering."""
        for url in self.start_urls:
            yield scrapy.Request(
                url,
                callback=self.parse,
                meta={
                    "playwright": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_load_state", "networkidle"),
                    ],
                },
            )

    def parse(self, response):
        """Extract data using configured selectors."""
        self.pages_scraped += 1

        # Extract data using CSS selectors
        item = {
            "url": response.url,
            "page_number": self.pages_scraped,
            "job_id": self.job_id,
            "session_id": self.session_id,
        }

        for field_name, selector in self.selectors.items():
            if isinstance(selector, dict):
                # Complex selector with type
                sel = selector.get("selector", "")
                multiple = selector.get("multiple", False)
                if multiple:
                    item[field_name] = response.css(sel).getall()
                else:
                    item[field_name] = response.css(sel).get()
            else:
                # Simple string selector
                item[field_name] = response.css(selector).get()

        yield item

        # Follow pagination if configured
        if self.pages_scraped < self.max_pages:
            next_selector = self.pagination.get("selector")
            if next_selector:
                next_page = response.css(next_selector).attrib.get("href")
                if next_page:
                    yield response.follow(
                        next_page,
                        callback=self.parse,
                        meta={
                            "playwright": True,
                            "playwright_page_methods": [
                                PageMethod("wait_for_load_state", "networkidle"),
                            ],
                        },
                    )
