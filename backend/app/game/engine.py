import random
import secrets
from typing import Optional

from .enums import Shape, Color
from .models import Player, Secret


class GameEngine:

    MAX_PLAYERS = 8
    MAX_ATTEMPTS = 2

    def __init__(self):
        self.players: dict[str, Player] = {}

        # Player whose turn it currently is
        self.current_player_id: Optional[str] = None

        # Game state
        self.game_started = False
        self.winner_id: Optional[str] = None

        # Registration state
        self.registration_open = True

        # Number of spins
        self.spin_number = 0

        # Last player selected by the wheel. Used to prevent
        # the same player from being selected twice in a row.
        self.last_selected_player_id: Optional[str] = None

        # Shared public result of the latest guess.
        # This is exposed through /api/game so every screen
        # sees the same result.
        self.guess_number = 0
        self.last_guess_result: Optional[dict] = None

    # =========================================================
    # PLAYER MANAGEMENT
    # =========================================================

    def add_player(
        self,
        player_id: str,
        name: str,
        shape: Shape,
        color: Color,
    ) -> Player:

        # --------------------------------
        # REGISTRATION CHECK
        # --------------------------------

        if not self.registration_open:
            raise ValueError(
                "Registration is currently closed."
            )

        # --------------------------------
        # MAX PLAYERS
        # --------------------------------

        if len(self.players) >= self.MAX_PLAYERS:
            raise ValueError(
                "The game already has 8 players."
            )

        # --------------------------------
        # PLAYER ID
        # --------------------------------

        if player_id in self.players:
            raise ValueError(
                "Player already exists."
            )

        # --------------------------------
        # NAME CHECK
        # --------------------------------

        if any(
            player.name.lower() == name.lower()
            for player in self.players.values()
        ):
            raise ValueError(
                "A player with this name already exists."
            )

        # --------------------------------
        # UNIQUE COMBINATION CHECK
        # --------------------------------

        for player in self.players.values():

            if (
                player.secret.shape == shape
                and player.secret.color == color
            ):
                raise ValueError(
                    "This shape and color combination "
                    "has already been selected."
                )

        # --------------------------------
        # GENERATE PRIVATE TOKEN
        # --------------------------------

        token = secrets.token_urlsafe(32)

        # --------------------------------
        # CREATE PLAYER
        # --------------------------------

        player = Player(
            id=player_id,
            name=name,
            secret=Secret(
                shape=shape,
                color=color,
            ),
            token=token,
            attempts_remaining=self.MAX_ATTEMPTS,
            active=True,
            discovered_shape=None,
            discovered_color=None,
        )

        self.players[player_id] = player

        return player

    # =========================================================
    # REGISTRATION CONTROL
    # =========================================================

    def close_registration(self):

        if not self.registration_open:
            raise ValueError(
                "Registration is already closed."
            )

        if len(self.players) < 2:
            raise ValueError(
                "At least 2 players are required."
            )

        self.registration_open = False

        return {
            "registration_open": False,
            "players": len(self.players),
            "message": "Registration has been closed.",
        }

    # =========================================================
    # REOPEN REGISTRATION
    # =========================================================

    def open_registration(self):

        if self.game_started:
            raise ValueError(
                "Cannot open registration while the game is running."
            )

        self.registration_open = True

        return {
            "registration_open": True,
            "players": len(self.players),
            "message": "Registration is now open.",
        }

    # =========================================================
    # START GAME
    # =========================================================

    def start_game(self):

        if self.registration_open:
            raise ValueError(
                "Registration must be closed before starting the game."
            )

        if len(self.players) < 2:
            raise ValueError(
                "At least 2 players are required."
            )

        if self.game_started:
            raise ValueError(
                "The game has already started."
            )

        # Reset game-round state
        self.winner_id = None
        self.current_player_id = None
        self.spin_number = 0
        self.last_selected_player_id = None
        self.guess_number = 0
        self.last_guess_result = None

        self.game_started = True

        # First spin
        return self.spin()

    # =========================================================
    # SPIN WHEEL
    # =========================================================

    def spin(self) -> Player:

        if not self.game_started:
            raise ValueError(
                "The game has not started."
            )

        # --------------------------------
        # DON'T SPIN AFTER WINNER
        # --------------------------------

        if self.winner_id is not None:

            winner = self.players.get(self.winner_id)

            if winner:
                return winner

            raise ValueError(
                "The game has already ended."
            )

        # --------------------------------
        # GET ACTIVE PLAYERS
        # --------------------------------

        active_players = [
            player
            for player in self.players.values()
            if player.active
        ]

        if not active_players:
            raise ValueError(
                "There are no active players."
            )

        # --------------------------------
        # ONLY ONE PLAYER REMAINS
        # --------------------------------

        if len(active_players) == 1:

            winner = active_players[0]

            self.winner_id = winner.id

            self.current_player_id = None

            return winner

        # --------------------------------
        # SELECT RANDOM ACTIVE PLAYER
        # --------------------------------

        # Do not select the same contestant twice in a row
        # when another active contestant is available.
        selectable_players = active_players

        if self.last_selected_player_id is not None and len(active_players) > 1:
            selectable_players = [
                player
                for player in active_players
                if player.id != self.last_selected_player_id
            ]

        selected_player = random.choice(
            selectable_players
        )

        self.current_player_id = selected_player.id
        self.last_selected_player_id = selected_player.id

        # --------------------------------
        # RECORD SPIN
        # --------------------------------

        self.spin_number += 1

        return selected_player

    # =========================================================
    # MAKE GUESS
    # =========================================================

    def make_guess(
        self,
        guessing_player_id: str,
        target_player_id: str,
        guessed_shape: Shape,
        guessed_color: Color,
    ):

        if not self.game_started:
            raise ValueError(
                "The game has not started."
            )

        # --------------------------------
        # GAME ALREADY WON
        # --------------------------------

        if self.winner_id is not None:
            raise ValueError(
                "The game has already ended."
            )

        # --------------------------------
        # CURRENT PLAYER CHECK
        # --------------------------------

        if guessing_player_id != self.current_player_id:
            raise ValueError(
                "It is not this player's turn."
            )

        # --------------------------------
        # CANNOT GUESS YOURSELF
        # --------------------------------

        if guessing_player_id == target_player_id:
            raise ValueError(
                "You cannot guess yourself."
            )

        # --------------------------------
        # FIND PLAYERS
        # --------------------------------

        guessing_player = self.players.get(
            guessing_player_id
        )

        target_player = self.players.get(
            target_player_id
        )

        if guessing_player is None:
            raise ValueError(
                "Guessing player does not exist."
            )

        if target_player is None:
            raise ValueError(
                "Target player does not exist."
            )

        # --------------------------------
        # ACTIVE CHECKS
        # --------------------------------

        if not guessing_player.active:
            raise ValueError(
                "The guessing player has been eliminated."
            )

        if not target_player.active:
            raise ValueError(
                "The target player has already been eliminated."
            )

        # =====================================================
        # CHECK GUESS
        # =====================================================

        shape_correct = (
            guessed_shape == target_player.secret.shape
        )

        color_correct = (
            guessed_color == target_player.secret.color
        )

        # =====================================================
        # COMPLETELY CORRECT
        # =====================================================

        if shape_correct and color_correct:

            target_player.active = False

            result = {
                "result": "correct",
                "message": "CORRECT! PLAYER ELIMINATED.",
                "shape_correct": True,
                "color_correct": True,
                "eliminated_player": target_player.name,
                "secret": {
                    "shape": target_player.secret.shape.value,
                    "color": target_player.secret.color.value,
                },
                "attempts_remaining": (
                    guessing_player.attempts_remaining
                ),
                "guesser_eliminated": False,
            }

            # --------------------------------
            # CHECK WINNER
            # --------------------------------

            winner = self.check_winner()

            if winner:

                result["winner"] = {
                    "id": winner.id,
                    "name": winner.name,
                }

            self.guess_number += 1
            self.last_guess_result = {
                **result,
                "guesser_id": guessing_player.id,
                "guesser_name": guessing_player.name,
                "target_player_id": target_player.id,
                "target_player_name": target_player.name,
                "guessed_shape": guessed_shape.value,
                "guessed_color": guessed_color.value,
            }

            return result

        # =====================================================
        # PARTIAL INFORMATION
        # =====================================================

        if shape_correct:

            target_player.discovered_shape = (
                target_player.secret.shape
            )

        if color_correct:

            target_player.discovered_color = (
                target_player.secret.color
            )

        # =====================================================
        # WRONG / PARTIAL GUESS
        # =====================================================

        guessing_player.attempts_remaining -= 1

        eliminated_guesser = False

        if guessing_player.attempts_remaining <= 0:

            guessing_player.active = False

            eliminated_guesser = True

        # =====================================================
        # DETERMINE RESULT
        # =====================================================

        if shape_correct and not color_correct:

            result_type = (
                "shape_correct_color_incorrect"
            )

            message = (
                "SHAPE CORRECT — COLOR INCORRECT"
            )

        elif color_correct and not shape_correct:

            result_type = (
                "color_correct_shape_incorrect"
            )

            message = (
                "COLOR CORRECT — SHAPE INCORRECT"
            )

        else:

            result_type = (
                "shape_incorrect_color_incorrect"
            )

            message = (
                "SHAPE INCORRECT — COLOR INCORRECT"
            )

        # =====================================================
        # BUILD RESULT
        # =====================================================

        result = {

            "result": result_type,

            "message": message,

            "shape_correct": shape_correct,

            "color_correct": color_correct,

            "attempts_remaining": (
                guessing_player.attempts_remaining
            ),

            "guesser_eliminated": eliminated_guesser,

            "target_information": {

                "shape": (
                    target_player.discovered_shape.value
                    if target_player.discovered_shape
                    else None
                ),

                "color": (
                    target_player.discovered_color.value
                    if target_player.discovered_color
                    else None
                ),
            },
        }

        # =====================================================
        # CHECK WINNER
        # =====================================================

        winner = self.check_winner()

        if winner:

            result["winner"] = {
                "id": winner.id,
                "name": winner.name,
            }

        self.guess_number += 1
        self.last_guess_result = {
            **result,
            "guesser_id": guessing_player.id,
            "guesser_name": guessing_player.name,
            "target_player_id": target_player.id,
            "target_player_name": target_player.name,
            "guessed_shape": guessed_shape.value,
            "guessed_color": guessed_color.value,
        }

        return result

    # =========================================================
    # WINNER
    # =========================================================

    def check_winner(self):

        active_players = [
            player
            for player in self.players.values()
            if player.active
        ]

        if len(active_players) == 1:

            self.winner_id = active_players[0].id

            self.current_player_id = None

            return active_players[0]

        return None

    # =========================================================
    # ACTIVE PLAYERS
    # =========================================================

    def get_active_players(self):

        return [
            player
            for player in self.players.values()
            if player.active
        ]

    # =========================================================
    # GET PLAYER
    # =========================================================

    def get_player(
        self,
        player_id: str,
    ) -> Optional[Player]:

        return self.players.get(player_id)

    # =========================================================
    # GET PLAYER BY TOKEN
    # =========================================================

    def get_player_by_token(
        self,
        token: str,
    ) -> Optional[Player]:

        for player in self.players.values():

            if player.token == token:
                return player

        return None

    # =========================================================
    # AVAILABLE COMBINATIONS
    # =========================================================

    def get_available_combinations(self):

        combinations = []

        for shape in Shape:

            for color in Color:

                combination_taken = any(
                    player.secret.shape == shape
                    and player.secret.color == color
                    for player in self.players.values()
                )

                if not combination_taken:

                    combinations.append({
                        "shape": shape.value,
                        "color": color.value,
                    })

        return combinations

    # =========================================================
    # RESET GAME
    # =========================================================

    def reset_game(self):

        self.players = {}

        self.current_player_id = None

        self.game_started = False

        self.winner_id = None

        self.registration_open = True

        self.spin_number = 0
        self.last_selected_player_id = None
        self.guess_number = 0
        self.last_guess_result = None

        return {
            "message": "Game has been reset successfully.",
            "registration_open": True,
            "players": 0,
            "max_players": self.MAX_PLAYERS,
            "available_combinations": 9,
            "game_started": False,
        }

    # =========================================================
    # GAME STATUS
    # =========================================================

    def get_game_status(self):

        active_players = self.get_active_players()

        current_player = None

        if self.current_player_id:

            current_player = self.players.get(
                self.current_player_id
            )

        winner = None

        if self.winner_id:

            winner = self.players.get(
                self.winner_id
            )

        return {

            "registration_open": (
                self.registration_open
            ),

            "game_started": (
                self.game_started
            ),

            "players_count": (
                len(self.players)
            ),

            "max_players": (
                self.MAX_PLAYERS
            ),

            "active_players": (
                len(active_players)
            ),

            "current_player": (
                {
                    "id": current_player.id,
                    "name": current_player.name,
                }
                if current_player
                else None
            ),

            "winner": (
                {
                    "id": winner.id,
                    "name": winner.name,
                }
                if winner
                else None
            ),

            "available_combinations": (
                len(
                    self.get_available_combinations()
                )
            ),

            "spin_number": (
                self.spin_number
            ),

            "guess_number": (
                self.guess_number
            ),

            "last_guess_result": (
                self.last_guess_result
            ),
        }