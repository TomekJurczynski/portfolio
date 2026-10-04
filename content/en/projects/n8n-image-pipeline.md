---
id: "n8n-image-pipeline"
name: "AI image pipeline (n8n)"
order: 5
layout: "workflow"
summary: "One-click n8n pipeline: three chained AI agents turn a theme into captioned, ready-to-use artwork."
stack:
  - "n8n"
  - "OpenAI GPT-4.1"
  - "gpt-image-1"
  - "Structured Output Parsers"
  - "Imgur API"
  - "Google Sheets"
role: "Sole builder — designed the agent chain, prompts and data flow, then reused the pipeline as a template for other use cases."
screenshots:
  - src: "/images/projects/n8n-image-pipeline/workflow.jpg"
    alt: "n8n canvas with two stages: Prompt Generating (Style, Character and Final agents with output parsers) and Build and storage (code, image generation, conversion, upload and Google Sheets nodes)"
    width: 1129
    height: 673
---

## Problem

Getting a steady stream of visually varied AI artwork means repeating the same creative work by hand: choose a style, choose subjects, write a long careful prompt, generate, host the file, keep track of what was made and how. The goal was a workflow that does all of that from a single click and produces images for personal use, such as posters and social-media posts.

## Decisions

The creative work is split across three narrow GPT-4.1 agents instead of one giant prompt. A Style Agent picks one of about 50 art directions (or invents a new one) and writes a title and a short caption with hashtags. A Character Agent picks three well-known characters from a 75-game list and returns only their clothing and colour scheme. A Final Agent merges both into three cinematic image prompts. Every agent returns JSON validated by a Structured Output Parser, so each stage hands the next one a predictable contract. Everything is stored, which means any image can be traced back to the exact prompt that produced it.

## Challenges

Language models are poor random-number generators, so "pick a game at random" was turned into an explicit procedure: think of a number from 1 to 75, then look it up in the list. This keeps variety high but is only pseudo-random, and a code node would be the stricter fix. Prompt quality needed concrete rules: early prompts with abstract sizing like "ten percent scale" produced vague, low-detail images, so the agent now has to describe framing in visual terms and mention resolution inside the prompt body, with one character per prompt. Data also had to survive being passed through several systems: newlines are stripped before prompts are embedded in the JSON request, and the Base64 image returned by the image API is converted to a file before being uploaded for a public link.

## Outcome

A working pipeline run manually whenever images are needed: it generates three portrait-format images plus title, caption, links and source prompts in one spreadsheet row. It then became a reusable template: copied and adapted for League of Legends character portraits in one fixed style, game landscape wallpapers in varied styles, and more practical uses such as book, notebook and exercise-book covers and custom birthday posters for friends. The same approach extended to separate email-automation workflows in n8n. The images are for personal use, and the characters belong to their respective publishers.
