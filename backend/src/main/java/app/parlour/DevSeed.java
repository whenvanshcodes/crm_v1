package app.parlour;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("local")
public class DevSeed {
  @Bean ApplicationRunner seedLocalData(JdbcTemplate jdbc) {
    return args -> {
      if (jdbc.queryForObject("SELECT COUNT(*) FROM venue", Integer.class) > 0) {
        jdbc.update("UPDATE resource SET status='AVAILABLE' WHERE venue_id='venue-demo' AND status='OCCUPIED' AND id NOT IN (SELECT resource_id FROM parlour_session WHERE venue_id='venue-demo' AND status='ACTIVE')");
        return;
      }
      jdbc.update("INSERT INTO venue(id,name,phone,currency,timezone,operating_hours) VALUES(?,?,?,?,?,?)", "venue-demo", "The Cue Club", "+91 98765 43210", "INR", "Asia/Kolkata", "10:00-02:00");
      jdbc.update("INSERT INTO app_user(id,venue_id,full_name,email,password_hash,role) VALUES(?,?,?,?,?,?)", "user-owner", "venue-demo", "Rohan Kapoor", "owner@thecueclub.in", "{dev-only}demo1234", "OWNER");
      String[][] cats = {{"cat-snoo", "Snooker"}, {"cat-pool", "Pool"}, {"cat-console", "Console"}, {"cat-game", "Gaming"}};
      for (String[] c : cats) jdbc.update("INSERT INTO resource_category(id,venue_id,name) VALUES(?,?,?)", c[0], "venue-demo", c[1]);
      String[][] resources = {{"res-s1","cat-snoo","Snooker Table 01","OCCUPIED","420"},{"res-s2","cat-snoo","Snooker Table 02","AVAILABLE","420"},{"res-p1","cat-pool","Pool Table 01","AVAILABLE","300"},{"res-ps5","cat-console","PS5 Station 01","AVAILABLE","240"},{"res-pc1","cat-game","Gaming PC 01","MAINTENANCE","180"}};
      for (String[] r : resources) {
        jdbc.update("INSERT INTO resource(id,venue_id,category_id,name,status) VALUES(?,?,?,?,?)", r[0], "venue-demo", r[1], r[2], r[3]);
        jdbc.update("INSERT INTO pricing_rule(id,venue_id,resource_id,name,rate_per_hour,minimum_minutes) VALUES(?,?,?,?,?,?)", "price-"+r[0], "venue-demo", r[0], "Standard hourly", r[4], 30);
      }
      String[][] customers = {{"cust-arjun","Arjun Mehta","+91 98765 12340"},{"cust-sara","Sara Khan","+91 98111 22330"},{"cust-dev","Dev Patel","+91 98989 00321"},{"cust-isha","Isha Rao","+91 99220 11223"}};
      for (String[] c : customers) jdbc.update("INSERT INTO customer(id,venue_id,full_name,phone) VALUES(?,?,?,?)", c[0], "venue-demo", c[1], c[2]);
    };
  }
}
