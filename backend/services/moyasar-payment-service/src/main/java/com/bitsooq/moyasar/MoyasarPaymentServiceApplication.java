package com.bitsooq.moyasar;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class MoyasarPaymentServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(MoyasarPaymentServiceApplication.class, args);
    }
}
