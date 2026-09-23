package com.jmorgan.showcase;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ShowcaseApplicationTests extends PostgresTestBase {

	@Test
	void contextLoads() {
	}

}
