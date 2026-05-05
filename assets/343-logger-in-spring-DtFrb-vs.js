const e=`---
title: "HTTP Request Logger in Springboot"
date: 2024-11-28
id: blog0343
tag:  springboot
toc: false
intro: "We record a simple logger for our spring application"
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

To define a logger it is as simple as defining an  \`OncePerRequestFilter\`. Springboot will pick it up to process each request in servlet level:

\`\`\`kt
@Component
class RequestResponseLoggingFilter : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(this::class.java)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val startTime = System.currentTimeMillis()

        // Wrap request and response to cache their body content
        val requestWrapper = ContentCachingRequestWrapper(request)
        val responseWrapper = ContentCachingResponseWrapper(response)

        // Get request URL and headers
        val requestURL = buildString {
            append(request.requestURL)
            request.queryString?.let {
                append("?").append(it)
            }
        }

        val headers = request.headerNames.toList()
            .associate { headerName ->
                headerName to request.getHeader(headerName)
            }
            .toString()

        try {
            // Execute the actual request
            filterChain.doFilter(requestWrapper, responseWrapper)
        } finally {
            val duration = System.currentTimeMillis() - startTime

            // Get request and response body content
            val requestBody = getContent(requestWrapper.contentAsByteArray, request.characterEncoding)
            val responseBody = getContent(responseWrapper.contentAsByteArray, response.characterEncoding)

            // Log all information
            log.info("""
                REQUEST AND RESPONSE DETAILS:
                [Request] \${request.method} $requestURL - \${response.status} in \${duration}ms
                [Headers] $headers
                [Request Body] $requestBody
                [Response Body] $responseBody
            """.trimIndent())

            // Copy content to the actual response
            responseWrapper.copyBodyToResponse()
        }
    }

    private fun getContent(content: ByteArray, charset: String?): String {
        return try {
            String(content, charset?.let { Charset.forName(it) } ?: StandardCharsets.UTF_8)
        } catch (e: Exception) {
            "Error reading content: \${e.message}"
        }
    }

    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        val path = request.requestURI
        return path.contains("/actuator") ||
                path.contains("/swagger") ||
                path.contains("/v3/api-docs")
    }

    companion object {
        private const val MAX_PAYLOAD_LENGTH = 10000
    }
}
\`\`\`


`;export{e as default};
