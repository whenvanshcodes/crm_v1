package app.parlour;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/** Local development write APIs. Production authentication/venue context must replace the demo tenant. */
@RestController
@RequestMapping("/api")
public class OperationsController {
  private static final String VENUE = "venue-demo";
  private final JdbcTemplate jdbc;
  public OperationsController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  private static String newId() { return UUID.randomUUID().toString(); }

  public record CustomerInput(@NotBlank String fullName, @NotBlank String phone, String email, String notes) {}
  public record ResourceInput(@NotBlank String name, @NotBlank String category, @NotNull @DecimalMin("0.00") BigDecimal hourlyRate) {}
  public record BookingInput(@NotBlank String customerId, @NotBlank String resourceId, @NotNull LocalDateTime startsAt, @NotNull LocalDateTime endsAt, String notes) {}
  public record SessionInput(@NotBlank String customerId, @NotBlank String resourceId, @NotBlank String pricingRuleId) {}
  public record PaymentInput(@NotBlank String method, @NotNull @DecimalMin("0.01") BigDecimal amount, String reference) {}

  @PostMapping("/customers") @ResponseStatus(HttpStatus.CREATED)
  @Transactional public Map<String,Object> createCustomer(@Valid @RequestBody CustomerInput input) {
    if (jdbc.queryForObject("SELECT COUNT(*) FROM customer WHERE venue_id=? AND phone=?", Integer.class, VENUE, input.phone()) > 0)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "A customer with this phone already exists");
    String id = newId();
    jdbc.update("INSERT INTO customer(id,venue_id,full_name,phone,email,notes) VALUES(?,?,?,?,?,?)", id, VENUE, input.fullName().trim(), input.phone().trim(), input.email(), input.notes());
    return jdbc.queryForMap("SELECT id,full_name,phone,email,visits,total_spend,notes FROM customer WHERE id=? AND venue_id=?", id, VENUE);
  }

  @PostMapping("/resources") @ResponseStatus(HttpStatus.CREATED)
  @Transactional public Map<String,Object> createResource(@Valid @RequestBody ResourceInput input) {
    String categoryId = jdbc.query("SELECT id FROM resource_category WHERE venue_id=? AND name=?", rs -> rs.next() ? rs.getString(1) : null, VENUE, input.category());
    if (categoryId == null) { categoryId = newId(); jdbc.update("INSERT INTO resource_category(id,venue_id,name) VALUES(?,?,?)", categoryId, VENUE, input.category()); }
    String resourceId = newId();
    jdbc.update("INSERT INTO resource(id,venue_id,category_id,name,status) VALUES(?,?,?,?, 'AVAILABLE')", resourceId, VENUE, categoryId, input.name().trim());
    jdbc.update("INSERT INTO pricing_rule(id,venue_id,resource_id,name,rate_per_hour,minimum_minutes) VALUES(?,?,?,?,?,30)", newId(), VENUE, resourceId, "Standard hourly", input.hourlyRate());
    return jdbc.queryForMap("SELECT id,name,status FROM resource WHERE id=? AND venue_id=?", resourceId, VENUE);
  }

  @PostMapping("/bookings") @ResponseStatus(HttpStatus.CREATED)
  @Transactional public Map<String,Object> createBooking(@Valid @RequestBody BookingInput input) {
    if (!input.endsAt().isAfter(input.startsAt())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End time must be after start time");
    lockResource(input.resourceId());
    requireCustomer(input.customerId());
    if (input.startsAt().isBefore(LocalDateTime.now())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking must start in the future");
    Integer conflict = jdbc.queryForObject("SELECT COUNT(*) FROM booking WHERE venue_id=? AND resource_id=? AND status='CONFIRMED' AND starts_at < ? AND ends_at > ?", Integer.class, VENUE, input.resourceId(), input.endsAt(), input.startsAt());
    Integer maintenance = jdbc.queryForObject("SELECT COUNT(*) FROM maintenance_block WHERE venue_id=? AND resource_id=? AND active=TRUE AND starts_at < ? AND ends_at > ?", Integer.class, VENUE, input.resourceId(), input.endsAt(), input.startsAt());
    if (conflict > 0 || maintenance > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Resource is not available for that time");
    String id = newId();
    jdbc.update("INSERT INTO booking(id,venue_id,customer_id,resource_id,starts_at,ends_at,status,notes) VALUES(?,?,?,?,?,?,'CONFIRMED',?)", id, VENUE, input.customerId(), input.resourceId(), input.startsAt(), input.endsAt(), input.notes());
    return jdbc.queryForMap("SELECT id,customer_id,resource_id,starts_at,ends_at,status FROM booking WHERE id=? AND venue_id=?", id, VENUE);
  }

  @PostMapping("/sessions") @ResponseStatus(HttpStatus.CREATED)
  @Transactional public Map<String,Object> startSession(@Valid @RequestBody SessionInput input) {
    lockResource(input.resourceId());
    requireCustomer(input.customerId());
    String active = jdbc.query("SELECT id FROM parlour_session WHERE venue_id=? AND resource_id=? AND status='ACTIVE'", rs -> rs.next() ? rs.getString(1) : null, VENUE, input.resourceId());
    if (active != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Resource already has an active session");
    Integer pricing = jdbc.queryForObject("SELECT COUNT(*) FROM pricing_rule WHERE id=? AND venue_id=? AND active=TRUE AND (resource_id IS NULL OR resource_id=?)", Integer.class, input.pricingRuleId(), VENUE, input.resourceId());
    if (pricing == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pricing rule is not valid for this resource");
    LocalDateTime start = LocalDateTime.now(), expected = start.plusHours(1);
    Integer conflict = jdbc.queryForObject("SELECT COUNT(*) FROM booking WHERE venue_id=? AND resource_id=? AND status='CONFIRMED' AND starts_at < ? AND ends_at > ?", Integer.class, VENUE, input.resourceId(), expected, start);
    if (conflict > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "A booking is due during the proposed session hour");
    String id = newId();
    jdbc.update("INSERT INTO parlour_session(id,venue_id,customer_id,resource_id,pricing_rule_id,started_at,expected_end_at,status) VALUES(?,?,?,?,?,?,?,'ACTIVE')", id, VENUE, input.customerId(), input.resourceId(), input.pricingRuleId(), start, expected);
    jdbc.update("UPDATE resource SET status='OCCUPIED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND venue_id=?", input.resourceId(), VENUE);
    return jdbc.queryForMap("SELECT id,customer_id,resource_id,pricing_rule_id,started_at,expected_end_at,status FROM parlour_session WHERE id=? AND venue_id=?", id, VENUE);
  }

  @PostMapping("/sessions/{id}/extend") @Transactional
  public Map<String,Object> extendSession(@PathVariable String id) {
    Map<String,Object> s = jdbc.query("SELECT id,resource_id,expected_end_at FROM parlour_session WHERE id=? AND venue_id=? AND status='ACTIVE' FOR UPDATE", rs -> rs.next() ? Map.of("id",rs.getString("id"),"resource",rs.getString("resource_id"),"end",rs.getTimestamp("expected_end_at").toLocalDateTime()) : null, id, VENUE);
    if (s == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Active session not found");
    LocalDateTime oldEnd = (LocalDateTime)s.get("end"), nextEnd = oldEnd.plusHours(1);
    Integer bookings = jdbc.queryForObject("SELECT COUNT(*) FROM booking WHERE venue_id=? AND resource_id=? AND status='CONFIRMED' AND starts_at < ? AND ends_at > ?", Integer.class, VENUE, s.get("resource"), nextEnd, oldEnd);
    Integer blocks = jdbc.queryForObject("SELECT COUNT(*) FROM maintenance_block WHERE venue_id=? AND resource_id=? AND active=TRUE AND starts_at < ? AND ends_at > ?", Integer.class, VENUE, s.get("resource"), nextEnd, oldEnd);
    if (bookings > 0 || blocks > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Resource is unavailable for the extension");
    jdbc.update("UPDATE parlour_session SET expected_end_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND venue_id=?", nextEnd, id, VENUE);
    return jdbc.queryForMap("SELECT id,expected_end_at,status FROM parlour_session WHERE id=? AND venue_id=?", id, VENUE);
  }

  @PostMapping("/sessions/{id}/end") @Transactional
  public Map<String,Object> endSession(@PathVariable String id) {
    var session = jdbc.query("SELECT id,customer_id,resource_id,pricing_rule_id,started_at,discount,status FROM parlour_session WHERE id=? AND venue_id=? FOR UPDATE", rs -> rs.next() ? new Object[]{rs.getString("customer_id"),rs.getString("resource_id"),rs.getString("pricing_rule_id"),rs.getTimestamp("started_at").toInstant(),rs.getBigDecimal("discount"),rs.getString("status")} : null, id, VENUE);
    if (session == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found");
    if (!"ACTIVE".equals(session[5])) throw new ResponseStatusException(HttpStatus.CONFLICT, "Session is already completed");
    Instant start = (Instant)session[3], end = Instant.now();
    var pricing = jdbc.queryForMap("SELECT rate_per_hour,minimum_minutes FROM pricing_rule WHERE id=? AND venue_id=?", session[2], VENUE);
    BigDecimal base = PricingEngine.calculate((BigDecimal)pricing.get("rate_per_hour"), start, end, ((Number)pricing.get("minimum_minutes")).intValue(), BigDecimal.ZERO);
    BigDecimal discount = (BigDecimal)session[4]; if (discount == null) discount = BigDecimal.ZERO;
    BigDecimal total = base.subtract(discount).max(BigDecimal.ZERO);
    String tx = newId();
    jdbc.update("INSERT INTO parlour_transaction(id,venue_id,session_id,amount,discount,tax,total) VALUES(?,?,?,?,?,0,?)", tx, VENUE, id, base, discount, total);
    jdbc.update("UPDATE parlour_session SET ended_at=?,status='COMPLETED',base_amount=?,final_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND venue_id=?", java.sql.Timestamp.from(end), base, total, id, VENUE);
    jdbc.update("UPDATE resource SET status='AVAILABLE',updated_at=CURRENT_TIMESTAMP WHERE id=? AND venue_id=?", session[1], VENUE);
    jdbc.update("UPDATE customer SET visits=visits+1,total_spend=total_spend+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND venue_id=?", total, session[0], VENUE);
    return Map.of("sessionId",id,"transactionId",tx,"endedAt",end.toString(),"durationMinutes",Math.max(1,(end.toEpochMilli()-start.toEpochMilli()+59999)/60000),"baseAmount",base,"discount",discount,"total",total);
  }

  @PostMapping("/transactions/{id}/payments") @ResponseStatus(HttpStatus.CREATED) @Transactional
  public Map<String,Object> recordPayment(@PathVariable String id, @Valid @RequestBody PaymentInput input) {
    String method = input.method().toUpperCase();
    if (!java.util.Set.of("CASH","UPI","CARD","OTHER").contains(method)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported payment method");
    BigDecimal total = jdbc.query("SELECT total FROM parlour_transaction WHERE id=? AND venue_id=? FOR UPDATE", rs -> rs.next() ? rs.getBigDecimal(1) : null, id, VENUE);
    if (total == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found");
    BigDecimal paid = jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM payment WHERE transaction_id=? AND venue_id=? AND status='PAID'", BigDecimal.class, id, VENUE);
    if (input.amount().compareTo(total.subtract(paid)) > 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment exceeds the outstanding amount");
    String payment = newId();
    jdbc.update("INSERT INTO payment(id,venue_id,transaction_id,amount,method,status,reference) VALUES(?,?,?,?,?,'PAID',?)", payment, VENUE, id, input.amount(), method, input.reference());
    return Map.of("id",payment,"transactionId",id,"amount",input.amount(),"method",method,"outstanding",total.subtract(paid).subtract(input.amount()));
  }

  private void lockResource(String resourceId) {
    String status = jdbc.query("SELECT status FROM resource WHERE id=? AND venue_id=? AND active=TRUE FOR UPDATE", rs -> rs.next() ? rs.getString(1) : null, resourceId, VENUE);
    if (status == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found");
    if (!"AVAILABLE".equals(status)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Resource is not available");
  }
  private void requireCustomer(String customerId) {
    Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM customer WHERE id=? AND venue_id=?", Integer.class, customerId, VENUE);
    if (exists == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found");
  }
}
