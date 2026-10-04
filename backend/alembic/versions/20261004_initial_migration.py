"""Initial migration: Building, EnergyReading, Baseline, Anomaly, Investigation

Revision ID: 20261004_initial
Revises: 
Create Date: 2026-10-04 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20261004_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Buildings table
    op.create_table(
        'buildings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('tariff', sa.Float(), nullable=False, server_default='8.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_buildings_id'), 'buildings', ['id'], unique=False)

    # 2. EnergyReadings table
    op.create_table(
        'energy_readings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('building_id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('energy_kwh', sa.Float(), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=True),
        sa.Column('occupancy', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['building_id'], ['buildings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('building_id', 'timestamp', name='uix_building_timestamp')
    )
    op.create_index(op.f('ix_energy_readings_building_id'), 'energy_readings', ['building_id'], unique=False)
    op.create_index(op.f('ix_energy_readings_id'), 'energy_readings', ['id'], unique=False)
    op.create_index(op.f('ix_energy_readings_timestamp'), 'energy_readings', ['timestamp'], unique=False)
    op.create_index('idx_building_timestamp', 'energy_readings', ['building_id', 'timestamp'], unique=False)

    # 3. Baselines table
    op.create_table(
        'baselines',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('building_id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expected_energy_kwh', sa.Float(), nullable=False),
        sa.Column('source', sa.String(length=100), nullable=False, server_default='ml_service'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['building_id'], ['buildings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_baselines_building_id'), 'baselines', ['building_id'], unique=False)
    op.create_index(op.f('ix_baselines_id'), 'baselines', ['id'], unique=False)
    op.create_index(op.f('ix_baselines_timestamp'), 'baselines', ['timestamp'], unique=False)
    op.create_index('idx_baseline_building_timestamp', 'baselines', ['building_id', 'timestamp'], unique=False)

    # 4. Anomalies table
    op.create_table(
        'anomalies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('building_id', sa.Integer(), nullable=False),
        sa.Column('energy_reading_id', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actual_energy_kwh', sa.Float(), nullable=False),
        sa.Column('expected_energy_kwh', sa.Float(), nullable=False),
        sa.Column('excess_kwh', sa.Float(), nullable=False),
        sa.Column('anomaly_score', sa.Float(), nullable=False),
        sa.Column('anomaly_status', sa.String(length=50), nullable=False, server_default='normal'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['building_id'], ['buildings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['energy_reading_id'], ['energy_readings.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_anomalies_building_id'), 'anomalies', ['building_id'], unique=False)
    op.create_index(op.f('ix_anomalies_energy_reading_id'), 'anomalies', ['energy_reading_id'], unique=False)
    op.create_index(op.f('ix_anomalies_id'), 'anomalies', ['id'], unique=False)
    op.create_index(op.f('ix_anomalies_timestamp'), 'anomalies', ['timestamp'], unique=False)
    op.create_index('idx_anomaly_building_timestamp', 'anomalies', ['building_id', 'timestamp'], unique=False)

    # 5. Investigations table
    op.create_table(
        'investigations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('anomaly_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='open'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['anomaly_id'], ['anomalies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_investigations_anomaly_id'), 'investigations', ['anomaly_id'], unique=False)
    op.create_index(op.f('ix_investigations_id'), 'investigations', ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('investigations')
    op.drop_table('anomalies')
    op.drop_table('baselines')
    op.drop_table('energy_readings')
    op.drop_table('buildings')
