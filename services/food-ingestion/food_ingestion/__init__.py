"""T1Dine food-composition ingestion workers.

Each national/regional source gets its own adapter package under
``food_ingestion`` (e.g. :mod:`food_ingestion.portfir` for the Portuguese
INSA/PortFIR BDCA table). Adapters are stdlib + ``openpyxl`` only, produce
immutable raw snapshots, and never mutate their source files.
"""

__version__ = "0.1.0"
