package com.jmorgan.showcase;

import com.jmorgan.showcase.github.GithubClientProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Does not carry {@code @EnableScheduling} itself — see
 * {@link SchedulingConfig} for why that lives in its own profile-gated
 * configuration class instead.
 */
@SpringBootApplication
@EnableConfigurationProperties(GithubClientProperties.class)
public class ShowcaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShowcaseApplication.class, args);
    }

}
