package com.ludo.king.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.ludo.king.model.GameHistory;
import java.util.List;

@Repository
public interface GameHistoryRepository extends JpaRepository<GameHistory, Long> {
    List<GameHistory> findTop20ByUsernameOrderByIdDesc(String username);
}
