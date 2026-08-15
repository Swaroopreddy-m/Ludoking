package com.ludo.king.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import com.ludo.king.websocket.LudoWebSocketHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final LudoWebSocketHandler ludoWebSocketHandler;

    @Autowired
    public WebSocketConfig(LudoWebSocketHandler ludoWebSocketHandler) {
        this.ludoWebSocketHandler = ludoWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(ludoWebSocketHandler, "/ws/ludo")
                .setAllowedOrigins("*");
    }
}
