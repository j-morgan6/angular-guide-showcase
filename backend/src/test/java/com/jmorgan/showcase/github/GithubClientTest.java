package com.jmorgan.showcase.github;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GithubClientTest {

    private static final String BASE = "https://api.github.com";

    private GithubClient clientWith(MockRestServiceServer[] serverOut, String token) {
        RestClient.Builder builder = RestClient.builder();
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        GithubClientProperties props = new GithubClientProperties(
                token, BASE, List.of("j-morgan6/angular-guide"), Duration.ofHours(6));
        return new GithubClient(builder, props);
    }

    @Test
    void decodesBase64FileContent() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "");

        String body = Base64.getEncoder().encodeToString("# Hello — em dash".getBytes(StandardCharsets.UTF_8));
        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide/contents/README.md"))
                .andRespond(withSuccess(
                        "{\"name\":\"README.md\",\"path\":\"README.md\",\"type\":\"file\",\"content\":\""
                                + body + "\",\"encoding\":\"base64\"}",
                        MediaType.APPLICATION_JSON));

        String content = client.fetchFile("j-morgan6/angular-guide", "README.md");

        assertThat(content).isEqualTo("# Hello — em dash");
        server[0].verify();
    }

    @Test
    void sendsAuthorizationHeaderWhenTokenIsPresent() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "ghp_example");

        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer ghp_example"))
                .andRespond(withSuccess("{\"name\":\"angular-guide\"}", MediaType.APPLICATION_JSON));

        client.fetchRepo("j-morgan6/angular-guide");

        server[0].verify();
    }

    @Test
    void returnsEmptyStringWhenFileIsMissing() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "");

        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide/contents/nope.md"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.NOT_FOUND));

        assertThat(client.fetchFile("j-morgan6/angular-guide", "nope.md")).isEmpty();
    }

    @Test
    void listsSkillDirectoryNames() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "");

        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide/contents/skills"))
                .andRespond(withSuccess("""
                        [{"name":"data-loading","path":"skills/data-loading","type":"dir"},
                         {"name":"README.md","path":"skills/README.md","type":"file"}]
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.listSkillNames("j-morgan6/angular-guide")).containsExactly("data-loading");
    }
}
