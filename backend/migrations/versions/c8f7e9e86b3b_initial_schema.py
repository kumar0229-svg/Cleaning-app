"""Initial schema

Revision ID: c8f7e9e86b3b
Revises:
Create Date: 2026-05-16 23:58:45.349405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision: str = 'c8f7e9e86b3b'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'system_config',
        sa.Column('config_key', sa.String(), nullable=False),
        sa.Column('config_value', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('config_key'),
    )

    op.create_table(
        'facilities',
        sa.Column('facility_id', sa.Integer(), nullable=False),
        sa.Column('facility_name', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('facility_id'),
        sa.UniqueConstraint('facility_name'),
    )
    op.create_index('ix_facilities_facility_id', 'facilities', ['facility_id'], unique=False)

    op.create_table(
        'equipment_category',
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('category_name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('category_id'),
        sa.UniqueConstraint('category_name'),
    )
    op.create_index('ix_equipment_category_category_id', 'equipment_category', ['category_id'], unique=False)

    op.create_table(
        'equipment',
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('equipment_name', sa.String(), nullable=True),
        sa.Column('facility_id', sa.Integer(), nullable=True),
        sa.Column('surface_area_cm2', sa.Float(), nullable=True),
        sa.Column('rinse_volume_liters', sa.Float(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('equipment_id'),
    )
    op.create_index('ix_equipment_equipment_id', 'equipment', ['equipment_id'], unique=False)

    op.create_table(
        'users',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('password', sa.String(), nullable=True),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('archived_by', sa.String(), nullable=True),
        sa.Column('archived_at', sa.String(), nullable=True),
        sa.Column('force_password_reset', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('user_id'),
        sa.UniqueConstraint('username'),
    )
    op.create_index('ix_users_user_id', 'users', ['user_id'], unique=False)

    op.create_table(
        'products',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('product_name', sa.String(), nullable=True),
        sa.Column('facility_id', sa.Integer(), nullable=True),
        sa.Column('min_therapeutic_dose_mg', sa.Float(), nullable=True),
        sa.Column('max_daily_dose_mg', sa.Float(), nullable=True),
        sa.Column('pde_mg_day', sa.Float(), nullable=True),
        sa.Column('min_yield_kg', sa.Float(), nullable=True),
        sa.Column('max_batch_size_kg', sa.Float(), nullable=True),
        sa.Column('lod_ppm', sa.Float(), nullable=True),
        sa.Column('loq_ppm', sa.Float(), nullable=True),
        sa.Column('analytical_method', sa.String(), nullable=True),
        sa.Column('solubility_usp', sa.Integer(), nullable=True),
        sa.Column('soluble_solvent', sa.String(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('archived_by', sa.String(), nullable=True),
        sa.Column('archived_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('product_id'),
    )
    op.create_index('ix_products_product_id', 'products', ['product_id'], unique=False)
    op.create_index('ix_products_product_name', 'products', ['product_name'], unique=False)
    op.create_index('ix_products_facility_id', 'products', ['facility_id'], unique=False)

    op.create_table(
        'product_equipment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('equipment_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_equipment_id', 'product_equipment', ['id'], unique=False)
    op.create_index('ix_product_equipment_product_id', 'product_equipment', ['product_id'], unique=False)
    op.create_index('ix_product_equipment_equipment_id', 'product_equipment', ['equipment_id'], unique=False)

    op.create_table(
        'maco_runs',
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('run_at', sa.String(), nullable=True),
        sa.Column('run_by', sa.String(), nullable=True),
        sa.Column('source_product_id', sa.Integer(), nullable=True),
        sa.Column('source_product_name', sa.String(), nullable=True),
        sa.Column('source_pde', sa.Float(), nullable=True),
        sa.Column('source_min_dose', sa.Float(), nullable=True),
        sa.Column('source_loq', sa.Float(), nullable=True),
        sa.Column('source_lod', sa.Float(), nullable=True),
        sa.Column('source_method', sa.String(), nullable=True),
        sa.Column('governing_maco', sa.Float(), nullable=True),
        sa.Column('result_json', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('run_id'),
    )
    op.create_index('ix_maco_runs_run_id', 'maco_runs', ['run_id'], unique=False)

    op.create_table(
        'maco_results',
        sa.Column('result_id', sa.Integer(), nullable=False),
        sa.Column('calc_id', sa.String(), nullable=True),
        sa.Column('product_from', sa.String(), nullable=True),
        sa.Column('product_to', sa.String(), nullable=True),
        sa.Column('equipment_id', sa.String(), nullable=True),
        sa.Column('method', sa.String(), nullable=True),
        sa.Column('maco_ug', sa.Float(), nullable=True),
        sa.Column('limit_ugcm2', sa.Float(), nullable=True),
        sa.Column('is_governing', sa.Boolean(), nullable=True),
        sa.Column('calculated_by', sa.String(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=func.now(), nullable=True),
        sa.PrimaryKeyConstraint('result_id'),
    )
    op.create_index('ix_maco_results_result_id', 'maco_results', ['result_id'], unique=False)
    op.create_index('ix_maco_results_calc_id', 'maco_results', ['calc_id'], unique=False)

    op.create_table(
        'audit_log',
        sa.Column('audit_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=True),
        sa.Column('entity_type', sa.String(), nullable=True),
        sa.Column('entity_id', sa.String(), nullable=True),
        sa.Column('field_name', sa.String(), nullable=True),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('performed_by', sa.String(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=func.now(), nullable=True),
        sa.PrimaryKeyConstraint('audit_id'),
    )
    op.create_index('ix_audit_log_audit_id', 'audit_log', ['audit_id'], unique=False)

    op.create_table(
        'protocol_archive',
        sa.Column('archive_id', sa.Integer(), nullable=False),
        sa.Column('doc_number', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('product_name', sa.String(), nullable=True),
        sa.Column('facility_name', sa.String(), nullable=True),
        sa.Column('generated_by', sa.String(), nullable=True),
        sa.Column('generated_at', sa.String(), nullable=True),
        sa.Column('snapshot_json', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True, server_default=sa.text("'Draft'")),
        sa.PrimaryKeyConstraint('archive_id'),
    )
    op.create_index('ix_protocol_archive_archive_id', 'protocol_archive', ['archive_id'], unique=False)
    op.create_index('ix_protocol_archive_doc_number', 'protocol_archive', ['doc_number'], unique=False)

    op.create_table(
        'sampling_plan_entry',
        sa.Column('entry_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('sample_number', sa.String(), nullable=False),
        sa.Column('location_description', sa.String(), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('entry_id'),
        sa.UniqueConstraint('sample_number'),
    )
    op.create_index('ix_sampling_plan_entry_entry_id', 'sampling_plan_entry', ['entry_id'], unique=False)

    op.create_table(
        'cleaning_validation_reports',
        sa.Column('report_id', sa.Integer(), nullable=False),
        sa.Column('archive_id', sa.Integer(), sa.ForeignKey('protocol_archive.archive_id'), nullable=True),
        sa.Column('facility_id', sa.Integer(), nullable=True),
        sa.Column('facility_name', sa.String(), nullable=True),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('product_name', sa.String(), nullable=True),
        sa.Column('results_data', sa.Text(), nullable=True),
        sa.Column('submitted_by', sa.String(), nullable=True),
        sa.Column('submitted_at', sa.String(), nullable=True),
        sa.Column('last_modified_by', sa.String(), nullable=True),
        sa.Column('last_modified_at', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('report_id'),
    )
    op.create_index('ix_cleaning_validation_reports_report_id', 'cleaning_validation_reports', ['report_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_cleaning_validation_reports_report_id', table_name='cleaning_validation_reports')
    op.drop_table('cleaning_validation_reports')

    op.drop_index('ix_sampling_plan_entry_entry_id', table_name='sampling_plan_entry')
    op.drop_table('sampling_plan_entry')

    op.drop_index('ix_protocol_archive_doc_number', table_name='protocol_archive')
    op.drop_index('ix_protocol_archive_archive_id', table_name='protocol_archive')
    op.drop_table('protocol_archive')

    op.drop_index('ix_audit_log_audit_id', table_name='audit_log')
    op.drop_table('audit_log')

    op.drop_index('ix_maco_results_calc_id', table_name='maco_results')
    op.drop_index('ix_maco_results_result_id', table_name='maco_results')
    op.drop_table('maco_results')

    op.drop_index('ix_maco_runs_run_id', table_name='maco_runs')
    op.drop_table('maco_runs')

    op.drop_index('ix_product_equipment_equipment_id', table_name='product_equipment')
    op.drop_index('ix_product_equipment_product_id', table_name='product_equipment')
    op.drop_index('ix_product_equipment_id', table_name='product_equipment')
    op.drop_table('product_equipment')

    op.drop_index('ix_products_facility_id', table_name='products')
    op.drop_index('ix_products_product_name', table_name='products')
    op.drop_index('ix_products_product_id', table_name='products')
    op.drop_table('products')

    op.drop_index('ix_users_user_id', table_name='users')
    op.drop_table('users')

    op.drop_index('ix_equipment_equipment_id', table_name='equipment')
    op.drop_table('equipment')

    op.drop_index('ix_equipment_category_category_id', table_name='equipment_category')
    op.drop_table('equipment_category')

    op.drop_index('ix_facilities_facility_id', table_name='facilities')
    op.drop_table('facilities')

    op.drop_table('system_config')
