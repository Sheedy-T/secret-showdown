from enum import Enum


class Shape(str, Enum):
    TRIANGLE = "triangle"
    CIRCLE = "circle"
    SQUARE = "square"


class Color(str, Enum):
    RED = "red"
    BLUE = "blue"
    GREEN = "green"