package app.parlour;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
  "spring.datasource.url=jdbc:h2:mem:parlour-it;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
  "spring.datasource.driver-class-name=org.h2.Driver"
})
class OperationsFlowTest {
  @Autowired TestRestTemplate http;

  @Test void bookingConflictAndSessionCheckoutPaymentFlow() {
    Map<String,Object> customerInput = Map.of("fullName","Integration Customer","phone","+91 90000000421");
    ResponseEntity<Map> customerResponse = http.postForEntity("/api/customers", customerInput, Map.class);
    assertEquals(HttpStatus.CREATED, customerResponse.getStatusCode());
    String customerId = customerResponse.getBody().get("id").toString();

    LocalDateTime starts = LocalDateTime.now().plusHours(3).withNano(0), ends = starts.plusHours(1);
    Map<String,Object> bookingInput = Map.of("customerId",customerId,"resourceId","res-s2","startsAt",starts.toString(),"endsAt",ends.toString());
    assertEquals(HttpStatus.CREATED, http.postForEntity("/api/bookings", bookingInput, Map.class).getStatusCode());
    assertEquals(HttpStatus.CONFLICT, http.postForEntity("/api/bookings", bookingInput, Map.class).getStatusCode());

    Map<String,Object> sessionInput = Map.of("customerId",customerId,"resourceId","res-p1","pricingRuleId","price-res-p1");
    ResponseEntity<Map> started = http.postForEntity("/api/sessions", sessionInput, Map.class);
    assertEquals(HttpStatus.CREATED, started.getStatusCode());
    String sessionId = started.getBody().get("id").toString();
    assertEquals(HttpStatus.CONFLICT, http.postForEntity("/api/sessions", sessionInput, Map.class).getStatusCode());

    ResponseEntity<Map> ended = http.postForEntity("/api/sessions/"+sessionId+"/end", Map.of(), Map.class);
    assertEquals(HttpStatus.OK, ended.getStatusCode());
    String transactionId = ended.getBody().get("transactionId").toString();
    BigDecimal total = new BigDecimal(ended.getBody().get("total").toString());
    assertTrue(total.signum() > 0);
    ResponseEntity<Map> payment = http.postForEntity("/api/transactions/"+transactionId+"/payments", Map.of("method","UPI","amount",total), Map.class);
    assertEquals(HttpStatus.CREATED, payment.getStatusCode());
    assertEquals(0, new BigDecimal(payment.getBody().get("outstanding").toString()).compareTo(BigDecimal.ZERO));
    assertNotNull(http.getForObject("/api/dashboard", Map.class));
  }
}
