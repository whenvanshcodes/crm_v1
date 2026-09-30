package app.parlour;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ApiController {
  private final JdbcTemplate jdbc;
  public ApiController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @GetMapping("/health") public Map<String, String> health() { return Map.of("status", "ok", "service", "parlour-api"); }
  @GetMapping("/dashboard") public Map<String, Object> dashboard() {
    String venue = "venue-demo";
    return Map.of(
      "activeSessions", jdbc.queryForObject("SELECT COUNT(*) FROM parlour_session WHERE venue_id=? AND status='ACTIVE'", Integer.class, venue),
      "availableResources", jdbc.queryForObject("SELECT COUNT(*) FROM resource WHERE venue_id=? AND status='AVAILABLE' AND active=TRUE", Integer.class, venue),
      "resourceCount", jdbc.queryForObject("SELECT COUNT(*) FROM resource WHERE venue_id=? AND active=TRUE", Integer.class, venue),
      "upcomingBookings", jdbc.queryForObject("SELECT COUNT(*) FROM booking WHERE venue_id=? AND status='CONFIRMED' AND starts_at>=CURRENT_TIMESTAMP", Integer.class, venue),
      "todayPayments", jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM payment WHERE venue_id=? AND created_at>=CURRENT_DATE", java.math.BigDecimal.class, venue)
    );
  }
  @GetMapping("/resources") public List<Map<String,Object>> resources() {
    return jdbc.queryForList("SELECT r.id,r.name,r.status,c.name AS category,p.id AS pricing_rule_id,p.rate_per_hour AS hourly_rate FROM resource r LEFT JOIN resource_category c ON c.id=r.category_id LEFT JOIN pricing_rule p ON p.resource_id=r.id AND p.active=TRUE WHERE r.venue_id=? AND r.active=TRUE ORDER BY r.name", "venue-demo");
  }
  @GetMapping("/customers") public List<Map<String,Object>> customers() {
    return jdbc.queryForList("SELECT id,full_name,phone,email,visits,total_spend,notes FROM customer WHERE venue_id=? ORDER BY full_name", "venue-demo");
  }
  @GetMapping("/bookings") public List<Map<String,Object>> bookings() {
    return jdbc.queryForList("SELECT b.id,b.customer_id,c.full_name AS customer,b.resource_id,r.name AS resource,b.starts_at,b.ends_at,b.status FROM booking b JOIN customer c ON c.id=b.customer_id JOIN resource r ON r.id=b.resource_id WHERE b.venue_id=? ORDER BY b.starts_at", "venue-demo");
  }
  @GetMapping("/sessions") public List<Map<String,Object>> sessions() {
    return jdbc.queryForList("SELECT s.id,s.customer_id,c.full_name AS customer,s.resource_id,r.name AS resource,s.pricing_rule_id,p.rate_per_hour,s.started_at,s.expected_end_at,s.ended_at,s.status,s.discount,s.final_amount FROM parlour_session s JOIN customer c ON c.id=s.customer_id JOIN resource r ON r.id=s.resource_id JOIN pricing_rule p ON p.id=s.pricing_rule_id WHERE s.venue_id=? ORDER BY s.started_at DESC", "venue-demo");
  }
  @GetMapping("/customers/lookup") public Map<String,Object> lookupCustomer(@RequestParam String phone) {
    String normalized = phone.replaceAll("\\D", "");
    List<Map<String,Object>> matches = jdbc.queryForList("SELECT id,full_name,phone,visits,total_spend,notes,updated_at FROM customer WHERE venue_id=? AND REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+','') LIKE ?", "venue-demo", "%" + normalized);
    if (matches.isEmpty()) return Map.of("found", false);
    Map<String,Object> row = new LinkedHashMap<>(matches.get(0)); row.put("found", true); return row;
  }
  @GetMapping("/bootstrap") public Map<String,Object> bootstrap() {
    return Map.of(
      "venue", jdbc.queryForMap("SELECT id,name,phone,currency,operating_hours FROM venue WHERE id=?", "venue-demo"),
      "resources", resources(), "customers", customers(), "bookings", bookings(), "sessions", sessions(),
      "payments", jdbc.queryForList("SELECT p.id,p.transaction_id,p.amount,p.method,p.created_at FROM payment p WHERE p.venue_id=? ORDER BY p.created_at DESC", "venue-demo")
    );
  }
}
