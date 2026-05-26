
# ===================================================
# DEHT HOURS CONFIG
# ===================================================
@app.get("/lifecycle/deht-hours")
def get_deht_hours(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    row = db.query(SystemConfig).filter(SystemConfig.config_key == "deht_hours").first()
    hours = int(row.config_value) if row else 72
    return {"hours": hours,
            "updated_by": row.updated_by if row else None,
            "updated_at": row.updated_at if row else None}


class DEHTHoursRequest(BaseModel):
    hours: int
    password: str

@app.put("/lifecycle/deht-hours")
def set_deht_hours(
    req: DEHTHoursRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if req.hours < 1 or req.hours > 720:
        raise HTTPException(status_code=400, detail="DEHT hours must be between 1 and 720 hours")
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    row = db.query(SystemConfig).filter(SystemConfig.config_key == "deht_hours").first()
    old_val = row.config_value if row else "72"
    if row:
        row.config_value = str(req.hours)
        row.updated_by   = current_user.username
        row.updated_at   = datetime.datetime.utcnow().isoformat()
    else:
        db.add(SystemConfig(config_key="deht_hours", config_value=str(req.hours),
                            updated_by=current_user.username,
                            updated_at=datetime.datetime.utcnow().isoformat()))
    db.commit()
    log_audit(db, "UPDATE", "SYSTEM", 0, "deht_hours", old_val, str(req.hours), current_user.username)
    return {"message": f"DEHT hours updated to {req.hours} hours"}


# ===================================================
# DEHT REPORTS
# ===================================================
class DEHTResultsData(BaseModel):
    runs: list = []
    training_details: Optional[str] = ""
    sop_followed: Optional[str] = ""
    completion_date: Optional[str] = None
    deht_hours_limit: Optional[int] = 72

class DEHTReportCreateRequest(BaseModel):
    archive_id: int
    results_data: DEHTResultsData
    password: Optional[str] = None
    is_draft: bool = False

class DEHTReportUpdateRequest(BaseModel):
    results_data: DEHTResultsData
    password: Optional[str] = None
    reason: str
    is_draft: bool = False

@app.post("/deht/report/create")
def create_deht_report(
    req: DEHTReportCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not req.is_draft:
        if not req.password:
            raise HTTPException(status_code=400, detail="Password required for submission")
        if not verify_password(req.password, current_user.password):
            raise HTTPException(status_code=401, detail="Incorrect password")

    archive = db.query(ProtocolArchive).filter(ProtocolArchive.archive_id == req.archive_id).first()
    if not archive:
        raise HTTPException(status_code=404, detail="DEHT protocol archive not found")
    if archive.status != "Final":
        raise HTTPException(status_code=400, detail="Protocol must be approved (status=Final)")

    existing = db.query(DEHTReport).filter(DEHTReport.archive_id == req.archive_id).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A DEHT report already exists for this protocol (Report #{existing.report_id}). Edit the existing report instead."
        )

    now = datetime.datetime.utcnow().isoformat()
    snap = json.loads(archive.snapshot_json) if archive.snapshot_json else {}
    report = DEHTReport(
        archive_id=req.archive_id,
        facility_id=snap.get("facility_id"),
        facility_name=archive.facility_name,
        product_id=archive.product_id,
        product_name=archive.product_name,
        results_data=json.dumps(req.results_data.dict(), separators=(",", ":")),
        submitted_by=current_user.username,
        submitted_at=now,
        created_at=now,
        status="Draft" if req.is_draft else "Submitted",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    log_audit(db, "CREATE", "DEHT_REPORT", report.report_id,
              "report_id", "", str(report.report_id), current_user.username)
    return {"report_id": report.report_id,
            "message": "Draft saved" if req.is_draft else "Report submitted successfully"}


@app.get("/deht/report/list")
def list_deht_reports(
    facility_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (db.query(DEHTReport, ProtocolArchive.doc_number)
               .outerjoin(ProtocolArchive, DEHTReport.archive_id == ProtocolArchive.archive_id))
    if facility_id:
        query = query.filter(DEHTReport.facility_id == facility_id)
    if product_id:
        query = query.filter(DEHTReport.product_id == product_id)
    rows = query.order_by(DEHTReport.submitted_at.desc()).all()
    return [
        {
            "report_id": r.report_id,
            "archive_id": r.archive_id,
            "doc_number": doc_number or "",
            "product_name": r.product_name,
            "facility_name": r.facility_name,
            "submitted_by": r.submitted_by,
            "submitted_at": r.submitted_at,
            "last_modified_by": r.last_modified_by,
            "last_modified_at": r.last_modified_at,
            "status": r.status or "Submitted",
            "approved_by": r.approved_by,
            "approved_at": r.approved_at,
        }
        for r, doc_number in rows
    ]


@app.get("/deht/report/{report_id}")
def get_deht_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(DEHTReport).filter(DEHTReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="DEHT report not found")
    archive = db.query(ProtocolArchive).filter(ProtocolArchive.archive_id == report.archive_id).first()
    return {
        "report_id": report.report_id,
        "archive_id": report.archive_id,
        "doc_number": archive.doc_number if archive else None,
        "product_name": report.product_name,
        "facility_name": report.facility_name,
        "submitted_by": report.submitted_by,
        "submitted_at": report.submitted_at,
        "last_modified_by": report.last_modified_by,
        "last_modified_at": report.last_modified_at,
        "status": report.status or "Submitted",
        "approved_by": report.approved_by,
        "approved_at": report.approved_at,
        "results_data": json.loads(report.results_data) if report.results_data else {},
        "protocol_snapshot": json.loads(archive.snapshot_json) if archive else None,
    }


@app.put("/deht/report/{report_id}")
def update_deht_report(
    report_id: int,
    req: DEHTReportUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not req.is_draft:
        if not req.password:
            raise HTTPException(status_code=400, detail="Password required for submission")
        if not verify_password(req.password, current_user.password):
            raise HTTPException(status_code=401, detail="Incorrect password")
    report = db.query(DEHTReport).filter(DEHTReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="DEHT report not found")
    if report.status == "Approved":
        raise HTTPException(status_code=400, detail="Cannot edit an approved report")
    old_data = report.results_data
    report.results_data = json.dumps(req.results_data.dict(), separators=(",", ":"))
    report.last_modified_by = current_user.username
    report.last_modified_at = datetime.datetime.utcnow().isoformat()
    if not req.is_draft:
        report.status = "Submitted"
    db.commit()
    log_audit(db, "UPDATE", "DEHT_REPORT", report_id,
              "results_data", (old_data or "")[:100], report.results_data[:100], current_user.username)
    return {"report_id": report.report_id,
            "message": "Draft saved" if req.is_draft else "Report submitted successfully"}


@app.post("/deht/report/{report_id}/approve")
def approve_deht_report(
    report_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    report = db.query(DEHTReport).filter(DEHTReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="DEHT report not found")
    if report.status == "Approved":
        raise HTTPException(status_code=400, detail="Report is already approved")
    if report.status == "Draft":
        raise HTTPException(status_code=400, detail="Cannot approve a Draft report. Submit it first.")
    report.status = "Approved"
    report.approved_by = current_user.username
    report.approved_at = datetime.datetime.utcnow().isoformat()
    db.commit()
    log_audit(db, "APPROVE", "DEHT_REPORT", report_id,
              "status", "Submitted", "Approved", current_user.username)
    return {"message": "DEHT report approved", "report_id": report_id}


@app.delete("/deht/report/{report_id}")
def delete_deht_report(
    report_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    report = db.query(DEHTReport).filter(DEHTReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="DEHT report not found")
    log_audit(db, "DELETE", "DEHT_REPORT", report_id,
              "report_id", str(report_id), "", current_user.username)
    db.delete(report)
    db.commit()
    return {"message": "DEHT report deleted"}
