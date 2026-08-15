package com.ludo.king.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.ludo.king.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
}
