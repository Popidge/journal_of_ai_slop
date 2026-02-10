---
layout: ../layouts/MarkdownPageLayout.astro
title: Privacy Policy
description: How The Journal of AI Slop handles personal data and moderation data.
---

# Privacy Policy: The Journal of AI Slop™

**Last updated**: 10 Febuary 2026  
**Data Controller**: Recue Ltd (UK Company No. 16717054)  
**Data Protection Officer**: Jamie Taylor (Editor-in-Chief)  
**Contact**: editor@journalofaislop.com

---

## **1. Who We Are & Our Legal Basis**

**The Journal of AI Slop™** is published by **Recue Ltd**, a UK-registered company. As the sole operator, I (Jamie Taylor) am legally designated as both **Data Controller** and **Data Processor** under UK GDPR. I am reachable at **editor@journalofaislop.com** for all data protection matters.

**Legal basis for processing**:

- **Consent**: You voluntarily provide email addresses for notifications (optional)
- **Legitimate interest**: We process paper content for publication, moderation, and journal operations
- **Legal obligation**: We must retain certain data for content moderation and safety compliance

---

## **2. What Personal Data We Collect**

### **A. Required Data (for journal operation)**

- **Paper content**: Title, authors, full text (you may include PII; see Section 3)
- **IP address**: Automatically logged for rate limiting and security (stored for 30 days)
- **Submission timestamp**: For queue management and temporal ordering

### **B. Optional Data (for notifications)**

- **Email address**: **Only if you opt-in** during submission. Used exclusively for:
  - "Published" notification
  - "Rejected" notification
- **Name**: Only if included in paper metadata (e.g., "Jamie Taylor")

**You are not required to provide real names or identifying information**. Pseudonyms are allowed (e.g., "SLOPBOT", "Brenda from Marketing").

---

## **3. Paper Content & PII**

**You may include personal data in your paper content** (e.g., names, anecdotes, locations). **By submitting, you warrant**:

- You have the right to include that information
- You understand it will be **publicly published** under CC BY-NC-SA 4.0

**Azure AI Content Safety**: We employ Microsoft's Azure AI Content Safety to scan all submissions for:

- **Illegal content** (CSAM, terrorism, hate speech)
- **Doxxing attempts** (phone numbers, addresses, etc.)

**If Azure flags PII**: The paper is **blocked** and **never published**, either as a rejection or publication. You will not be notified, even if requested. **We do not store flagged content**.

**If PII slips through**: Email `editor@journalofaislop.com` with the paper ID, link, or title. We will **remove the PII** within 30 days and **report the violation** to Azure for retraining.

---

## **4. How We Use Your Data & Who We Share It With**

### **A. For Journal Operations**

- **Convex**: Stores paper content, metadata, review votes. **GDPR compliant**. Data retained until you request deletion.
- **Vercel**: Hosts the site, logs IP addresses for 30 days. **GDPR compliant**.
- **Resend**: Sends email notifications (if you opt-in). **GDPR compliant**. **Emails deleted from Resend logs after 30 days** (their policy).

### **B. For Content Moderation**

- **Azure AI Content Safety**: Scans paper content for illegal material. **Does not retain your data** after scanning. **GDPR compliant**.
- **OpenRouter**: Sends paper content to LLMs for review. **Does not retain data** beyond inference. **GDPR compliant**.

### **C. For Publication**

- **Published papers**: **Permanently public** under CC BY-NC-SA 4.0
- **Metadata**: Title, authors, tags, DOI, review votes **publicly searchable**
- **Carbon metrics**: Publicly displayed (anonymized)

---

## **5. Data Retention & Deletion**

### **A. Published Papers**

### Published papers are **retained permanently**, but if you request erasure, we will:

1. **Remove your name** (anonymize)
2. **Keep the paper content** (scholarly record)
3. **Replace your authorship with "Anonymous Researcher"**
4. Maintain any paper metadata schema (SLOP ID, or DOI if implemented, but point to anonymized version)
5. Full deletion only for illegal content

Research articles are considered an exception under UK GDPR (Article 17(3)) due to their scholarly value. However, given the nature of this journal, we will **anonymize** your name if you request erasure, ensuring Personally Identifiable Information (PII) is not associated with your work.

### **B. Rejected Papers**

- **Retained**: **7 days** in queue, then **deleted** (unless flagged for moderation)
- **Your right**: **Immediate deletion** upon request

### **C. Email Addresses**

- **Retained**: **Until an email is sent notifying you of publication or rejection, then deleted from our Convex backend**
- **Deletion**: Email `editor@journalofaislop.com` → removed within **30 days**
- **Resend logs**: **Auto-deleted after 30 days** (their policy)

### **D. IP Addresses**

- **Retained**: **30 days** for rate limiting, then **deleted**
- **Your right**: **Cannot be deleted early** (security requirement)

---

## **6. Your GDPR Rights**

Under UK GDPR, you have the right to:

### **A. Access**

Request a copy of all data we hold about you. Email `editor@journalofaislop.com` with subject "GDPR Access Request". We will respond within **30 days**.

### **B. Rectification**

Request correction of inaccurate data. For published papers, we can **add errata** but **cannot alter the original** (academic integrity). For unpublished data, we will correct within **7 days**.

### **C. Erasure ("Right to be Forgotten")**

Request deletion of your data **EXCEPT**:

- **Content of published papers** (see Section 5A for further information)
- **IP logs** (security, 30-day retention)
- **Moderation logs** (legal obligation, kept for 1 year)

**Process**: Email `editor@journalofaislop.com` → we delete within **30 days** (except where legally prohibited).

### **D. Portability**

Request your data in **machine-readable format** (JSON). We will provide within **30 days**.

### **E. Objection**

Object to processing **based on legitimate interest**. **We will comply** unless we have **compelling legal grounds** (e.g., illegal content reporting).

### **F. Restrict Processing**

Request we **stop processing** your data. **We will comply** for non-essential processing (e.g., email notifications).

### **G. Withdraw Consent**

If you opted into email notifications, **unsubscribe link in every email** or email `editor@journalofaislop.com`. **Immediate effect**.

---

## **7. Data Security**

**Technical measures**:

- **Encryption at rest**: Convex (AES-256), Vercel (TLS 1.3)
- **Encryption in transit**: All API calls use HTTPS
- **Access controls**: Only Editor-in-Chief (Jamie Taylor) has admin access
- **Audit logs**: All moderation actions logged (retained 1 year)

**Organizational measures**:

- **Annual GDPR training** (me, reading this policy)
- **Incident response plan**: If breach occurs, notify ICO within 72 hours, notify affected users within 24 hours
- **Data minimization**: We only collect what's necessary (email optional, IP required for security)

---

## **8. Complaints to ICO**

If you believe I've mishandled your data, you have the right to lodge a complaint with the **Information Commissioner's Office (ICO)**:

**Website**: https://ico.org.uk/make-a-complaint/  
**Phone**: 0303 123 1113  
**Address**: Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF

**Before complaining to ICO**, please **email me first** (`editor@journalofaislop.com`). I will **genuinely try to resolve it**. I'm a solo developer, not a data-hungry corporation, and I take data protection seriously.

---

## **9. Changes to This Policy**

**I will update this policy** as the journal evolves. **Last updated date** is at the top. We do not routinely store email addresses, so even if you have provided it alongside a paper, we will not be able to contact you with **major changes**.

**Check back periodically**: **https://journalofaislop.com/privacy-policy**

---

## **10. Contact for Data Protection Issues**

**Data Controller**: Jamie Taylor  
**Company**: Recue Ltd (Company No. 16717054)  
**Email**: **editor@journalofaislop.com**  
**Response time**: **Within 7 days** (I'm one person, but I care)

**For urgent issues** (e.g., data breach, illegal content): **Email subject "URGENT DPO"** → I will **respond within 24 hours**.

---

**Last updated**: 10 Febuary 2026  
**Next review**: 10 Febuary 2027
