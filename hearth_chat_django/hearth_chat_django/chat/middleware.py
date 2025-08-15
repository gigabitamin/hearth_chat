import time
import logging
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache

logger = logging.getLogger(__name__)

class PerformanceMonitoringMiddleware(MiddlewareMixin):
    """API 성능 모니터링 미들웨어"""
    
    def process_request(self, request):
        request.start_time = time.time()
    
    def process_response(self, request, response):
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
            
            # 느린 요청 로깅 (1초 이상)
            if duration > 1.0:
                logger.warning(
                    f'Slow request: {request.method} {request.path} '
                    f'took {duration:.2f}s'
                )
            
            # 응답 헤더에 처리 시간 추가
            response['X-Response-Time'] = f'{duration:.3f}s'
            
            # 캐시 히트율 모니터링
            if 'cache_hit' in request.META:
                cache_key = f"api_stats_{request.path}"
                stats = cache.get(cache_key, {'hits': 0, 'misses': 0, 'total_time': 0})
                if request.META['cache_hit']:
                    stats['hits'] += 1
                else:
                    stats['misses'] += 1
                stats['total_time'] += duration
                cache.set(cache_key, stats, 3600)  # 1시간간 저장
        
        return response

class QueryCountMiddleware(MiddlewareMixin):
    """데이터베이스 쿼리 수 모니터링 미들웨어"""
    
    def process_request(self, request):
        from django.db import connection
        connection.queries_log = True
        request.queries_start = len(connection.queries)
    
    def process_response(self, request, response):
        from django.db import connection
        if hasattr(request, 'queries_start'):
            query_count = len(connection.queries) - request.queries_start
            
            # 과도한 쿼리 수 로깅 (50개 이상)
            if query_count > 50:
                logger.warning(
                    f'High query count: {request.method} {request.path} '
                    f'executed {query_count} queries'
                )
            
            # 응답 헤더에 쿼리 수 추가
            response['X-Query-Count'] = str(query_count)
        
        return response 