package com.example.student;

import com.example.student.dto.AuthResponse;
import com.example.student.dto.LoginRequest;
import com.example.student.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ControllersTest {
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;
    @Autowired
    private StudentRepository students;

    private String admin;
    private String teacher;
    private String superAdmin;

    @BeforeEach
    void setUp() throws Exception {
        students.deleteAll();
        students.flush();
        admin = login("admin@example.com", "admin");
        teacher = login("teacher@example.com", "teacher");
        superAdmin = login("superadmin@example.com", "superAdmin");
    }

    @Test
    void testLogin() throws Exception {
        // Предусловие: администратор есть в базе.
        // Передаваемые данные: admin@example.com / admin.
        // Ожидаемый результат: 200, токен и роль ADMIN.
        send("POST", "/api/v1/auth/login", null, """
                {"email":"admin@example.com","password":"admin"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.type").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(3600))
                .andExpect(jsonPath("$.roles[0]").value("ROLE_ADMIN"));
    }

    @Test
    void testStudentCrud() throws Exception {
        // Предусловие: студентов пока нет.
        // Передаваемые данные: Ivan Petrov, затем новые email и телефон.
        // Ожидаемый результат: запись создаётся, обновляется и удаляется.
        send("GET", "/api/v1/student", teacher, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response").isEmpty())
                .andExpect(jsonPath("$.totalCount").value(0));

        var created = send("POST", "/api/v1/student/save", admin, """
                {"name":"Ivan","surname":"Petrov","email":"ivan@example.com","phone_number":"12345"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ivan"));
        long id = idFrom(created);

        send("GET", "/api/v1/student", teacher, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.response[0].id").value(id));
        send("GET", "/api/v1/student/" + id, teacher, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.surname").value("Petrov"));
        send("GET", "/api/v1/student/info/" + id, admin, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ivan@example.com"))
                .andExpect(jsonPath("$.phoneNumber").value("12345"));

        send("PUT", "/api/v1/student/" + id, admin, """
                {"email":"updated@example.com","phoneNumber":"777"}
                """).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        send("GET", "/api/v1/student/" + id, admin, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("updated@example.com"))
                .andExpect(jsonPath("$.phoneNumber").value("777"));

        send("DELETE", "/api/v1/student/" + id, admin, null).andExpect(status().isOk());
        send("GET", "/api/v1/student/" + id, admin, null).andExpect(status().isNotFound());
    }

    @Test
    void testUserCrud() throws Exception {
        // Предусловие: вход под SUPER_ADMIN, в базе три пользователя.
        // Передаваемые данные: новый пользователь, затем другой email и роль.
        // Ожидаемый результат: CRUD работает, пароль не попадает в ответ.
        var created = send("POST", "/api/v1/users/save", superAdmin, """
                {"email":"new@example.com","password":"secret","roles":["TEACHER"]}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.roles[0]").value("TEACHER"));
        long id = idFrom(created);

        send("GET", "/api/v1/users", superAdmin, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(4))
                .andExpect(jsonPath("$.responses[*].password").isEmpty());

        send("PUT", "/api/v1/users/" + id, superAdmin, """
                {"email":"updated@example.com","roles":["ADMIN"]}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.email").value("updated@example.com"))
                .andExpect(jsonPath("$.roles[0]").value("ADMIN"))
                .andExpect(jsonPath("$.password").doesNotExist());
        String token = login("updated@example.com", "secret");
        send("GET", "/api/v1/student", token, null).andExpect(status().isOk());

        send("DELETE", "/api/v1/users/" + id, superAdmin, null).andExpect(status().isOk());
        send("GET", "/api/v1/users", superAdmin, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(3))
                .andExpect(jsonPath("$.responses[?(@.id == " + id + ")]").isEmpty());
    }

    @Test
    void testDuplicateEmail() throws Exception {
        // Предусловие: admin@example.com уже занят.
        // Передаваемые данные: новый пользователь с тем же email.
        // Ожидаемый результат: 409.
        send("POST", "/api/v1/users/save", superAdmin, """
                {"email":"admin@example.com","password":"secret","roles":["TEACHER"]}
                """).andExpect(status().isConflict()).andExpect(jsonPath("$.statusCode").value(409));
    }

    @Test
    void testNotFound() throws Exception {
        // Предусловие: записи с ID 999999 нет.
        // Передаваемые данные: GET и PUT с этим ID.
        // Ожидаемый результат: 404.
        send("GET", "/api/v1/student/999999", admin, null)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.statusCode").value(404));
        send("GET", "/api/v1/student/info/999999", teacher, null).andExpect(status().isNotFound());
        send("PUT", "/api/v1/student/999999", admin, "{}").andExpect(status().isNotFound());
        send("PUT", "/api/v1/users/999999", superAdmin,
                "{\"email\":\"missing@example.com\",\"roles\":[\"ADMIN\"]}").andExpect(status().isNotFound());
    }

    @Test
    void testBadRequest() throws Exception {
        // Предусловие: вход под ролью с нужными правами.
        // Передаваемые данные: неверный email, незакрытый JSON или invalid вместо ID.
        // Ожидаемый результат: 400.
        send("POST", "/api/v1/auth/login", null, """
                {"email":"invalid","password":""}
                """).andExpect(status().isBadRequest());
        send("POST", "/api/v1/student/save", admin, "{").andExpect(status().isBadRequest());
        send("PUT", "/api/v1/student/1", admin, "{").andExpect(status().isBadRequest());
        send("POST", "/api/v1/users/save", superAdmin, "{").andExpect(status().isBadRequest());
        send("PUT", "/api/v1/users/1", superAdmin, "{").andExpect(status().isBadRequest());
        send("GET", "/api/v1/student/invalid", admin, null).andExpect(status().isBadRequest());
    }

    @Test
    void testUnauthorized() throws Exception {
        // Предусловие: admin@example.com есть, missing@example.com нет.
        // Передаваемые данные: пароль wrong или токен invalid-token.
        // Ожидаемый результат: 401.
        send("POST", "/api/v1/auth/login", null, """
                {"email":"admin@example.com","password":"wrong"}
                """).andExpect(status().isUnauthorized());
        send("POST", "/api/v1/auth/login", null, """
                {"email":"missing@example.com","password":"wrong"}
                """).andExpect(status().isUnauthorized());
        send("GET", "/api/v1/student", "invalid-token", null).andExpect(status().isUnauthorized());
    }

    @Test
    void testRoles() throws Exception {
        // Предусловие: получены токены трёх ролей.
        // Передаваемые данные: запросы без прав на выбранную ручку или без токена.
        // Ожидаемый результат: 403.
        send("POST", "/api/v1/student/save", teacher, "{}").andExpect(status().isForbidden());
        send("DELETE", "/api/v1/student/1", teacher, null).andExpect(status().isForbidden());
        send("GET", "/api/v1/student", superAdmin, null).andExpect(status().isForbidden());
        send("GET", "/api/v1/users", admin, null).andExpect(status().isForbidden());
        send("GET", "/api/v1/student", null, null).andExpect(status().isForbidden());
        send("GET", "/api/v1/users", null, null).andExpect(status().isForbidden());
    }

    private ResultActions send(String method, String path, String token, String body) throws Exception {
        var builder = request(HttpMethod.valueOf(method), path);
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(builder);
    }

    private String login(String email, String password) throws Exception {
        String content = send("POST", "/api/v1/auth/login", null,
                json.writeValueAsString(new LoginRequest(email, password)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readValue(content, AuthResponse.class).getToken();
    }

    private long idFrom(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString()).path("id").asLong();
    }
}
