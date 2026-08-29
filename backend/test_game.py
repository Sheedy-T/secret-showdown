from app.game.engine import GameEngine
from app.game.enums import Shape, Color


game = GameEngine()


# -------------------------
# ADD PLAYERS
# -------------------------

game.add_player(
    "1",
    "David",
    Shape.CIRCLE,
    Color.GREEN,
)

game.add_player(
    "2",
    "Michael",
    Shape.SQUARE,
    Color.RED,
)

game.add_player(
    "3",
    "Sarah",
    Shape.TRIANGLE,
    Color.BLUE,
)

game.add_player(
    "4",
    "John",
    Shape.CIRCLE,
    Color.RED,
)


# -------------------------
# START GAME
# -------------------------

first_player = game.start_game()

print("\nFIRST PLAYER:")
print(first_player.name)


# -------------------------
# FORCE DAVID'S TURN
# -------------------------

game.current_player_id = "1"


# David guesses Michael
#
# Michael actually has:
# RED SQUARE
#
# David guesses:
# BLUE SQUARE
#
# Shape = CORRECT
# Color = WRONG
# -------------------------

result = game.make_guess(
    guessing_player_id="1",
    target_player_id="2",
    guessed_shape=Shape.SQUARE,
    guessed_color=Color.BLUE,
)


print("\nGUESS RESULT")
print("------------")

print(result)

print("\nTESTING DUPLICATE SECRET")
print("------------------------")

try:
    game.add_player(
        "5",
        "David2",
        Shape.CIRCLE,
        Color.GREEN,
    )

except ValueError as error:
    print("Duplicate rejected:")
    print(error)