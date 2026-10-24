package com.japanese.vocabulary.admin.config

import com.japanese.vocabulary.admin.auth.AdminAuthentication
import com.japanese.vocabulary.admin.auth.AdminTokenAuthFilter
import com.japanese.vocabulary.admin.auth.LyricSyncAgentAuthentication
import jakarta.servlet.DispatcherType
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(AdminSecurityProperties::class)
class SecurityConfig(
    private val adminTokenAuthFilter: AdminTokenAuthFilter,
) {
    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .httpBasic { it.disable() }
            .formLogin { it.disable() }
            .authorizeHttpRequests { auth ->
                auth
                    .dispatcherTypeMatchers(DispatcherType.ERROR, DispatcherType.ASYNC).permitAll()
                    .requestMatchers("/admin/api/auth/login").permitAll()
                    // 릴스 미리보기 MV 스트림은 <video src> 라 헤더를 못 붙인다. 컨트롤러가 query 의 미디어 토큰을 검사한다.
                    .requestMatchers(HttpMethod.GET, "/admin/api/reels-factory/songs/*/mv").permitAll()
                    .requestMatchers("/actuator/health/**").permitAll()
                    // Prometheus 스크레이프용
                    .requestMatchers("/actuator/prometheus").permitAll()
                    .requestMatchers("/error").permitAll()
                    // 실행기 토큰은 이 경로에만, admin 로그인 토큰은 이 경로를 뺀 나머지에만 쓴다.
                    .requestMatchers("/admin/api/lyric-sync-agent/**").hasAuthority(LyricSyncAgentAuthentication.AUTHORITY)
                    .requestMatchers("/admin/api/**").hasAuthority(AdminAuthentication.AUTHORITY)
                    .anyRequest().denyAll()
            }
            .addFilterBefore(adminTokenAuthFilter, UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        configuration.allowedOriginPatterns = listOf("http://localhost:*")
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        configuration.allowedHeaders = listOf("*")
        configuration.allowCredentials = false

        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/admin/api/**", configuration)
        return source
    }
}
