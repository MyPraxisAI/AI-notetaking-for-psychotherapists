-- Add demo clients for the demo account (one for each supported language)
DO $$
DECLARE
  demo_account_id UUID;
  demo_therapist_id UUID;
  -- English client
  en_yalom_id UUID := 'e0000000-e000-4000-a000-000000000002'::UUID; -- Irvin D. Yalom
  -- Russian client
  ru_yalom_id UUID := 'r0000000-r000-4000-a000-000000000002'::UUID; -- Ирвин Д. Ялом
  session_id UUID;
BEGIN
  -- Get the account ID and therapist ID for the demo user
  SELECT a.id, t.id INTO demo_account_id, demo_therapist_id
  FROM public.accounts a
  JOIN public.therapists t ON t.account_id = a.id
  WHERE a.primary_owner_user_id = 'dddddddd-dddd-4ddd-addd-dddddddddddd' AND a.is_personal_account = true;
  
  -- Create Irvin D. Yalom English demo client
  INSERT INTO public.clients (
    id,
    account_id,
    therapist_id,
    full_name,
    email,
    phone,
    demo
  ) VALUES (
    en_yalom_id,
    demo_account_id,
    demo_therapist_id,
    'Irvin D. Yalom',
    'irvin.yalom@example.com',
    '+1 (650) 555-7890',
    true
  );
  
  -- Create Yalom client bio artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    en_yalom_id,
    'client_bio',
    'Irvin is a 93-year-old retired psychiatrist and author who recently lost his wife of 65 years. He has sought therapy to process his grief and confront his own mortality. As a pioneering existential psychotherapist himself, he brings unique insight to the therapeutic process but acknowledges that his professional knowledge doesn''t shield him from the emotional impact of loss. He reports difficulty sleeping, intrusive memories, and periods of profound sadness. While he maintains close relationships with his four children and grandchildren, he expresses a deep sense of loneliness and questions about his remaining life purpose. Despite his extensive knowledge of psychological processes, he seeks a space to explore his emotions as a human being rather than as a clinician.',
    'en'
  );
  
  -- Create Yalom client goals artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    en_yalom_id,
    'client_goals',
    'Primary Goals:
1. Process and integrate the grief of losing Marilyn after 65 years of marriage
2. Address existential concerns about mortality and meaning in this stage of life
3. Explore and resolve feelings of guilt related to work-life balance
4. Develop new ways of relating to family members, particularly children
5. Find meaning and purpose in this new chapter of life

Secondary Goals:
1. Improve sleep quality and address sleep disturbances
2. Develop strategies for managing intrusive memories
3. Process unresolved grief from father''s death at age 15
4. Balance professional identity with personal vulnerability
5. Create new routines and structures for daily life

Progress Indicators:
- Reduced frequency of sleep disturbances
- Ability to discuss Marilyn without overwhelming distress
- Increased engagement with family members
- Development of new meaningful activities
- Integration of professional knowledge with emotional experience',
    'en'
  );

  -- Create Yalom client progress artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    en_yalom_id,
    'client_progress',
    'Initial Assessment (Session 1):
- Presenting with complicated grief following loss of wife
- Experiencing sleep disturbances and intrusive memories
- Demonstrating high insight but intellectualizing emotions
- Expressing existential concerns about mortality
- Showing willingness to engage in therapeutic process

Progress After Session 2:
- Increased emotional awareness and expression
- Beginning to explore family relationships more deeply
- Developing insight into work-life balance concerns
- Actively seeking new meaning through family connections
- Demonstrating ability to be vulnerable in therapy

Areas of Growth:
- Continued work on balancing intellectual understanding with emotional experience
- Ongoing exploration of family relationships
- Development of new daily routines
- Processing of early life experiences
- Integration of professional and personal identities

Next Steps:
- Continue dream work and exploration
- Deepen family relationship work
- Address sleep disturbances
- Explore new sources of meaning
- Process early life experiences',
    'en'
  );

  -- Create Yalom client notes artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    en_yalom_id,
    'client_notes',
    'Clinical Notes:

Background:
- 93-year-old retired psychiatrist and author
- Lost wife of 65 years to cancer
- Four children and multiple grandchildren
- Russian Jewish immigrant background
- Father died when client was 15
- Mother emphasized emotional suppression

Key Observations:
- High level of psychological insight
- Tendency to intellectualize emotions
- Strong transference awareness
- Complex relationship with professional identity
- Deep capacity for self-reflection
- Significant existential concerns

Treatment Considerations:
- Balance respect for client''s expertise with therapeutic needs
- Monitor for intellectualization as defense
- Use transference as therapeutic tool
- Address both current grief and historical patterns
- Support development of new meaning structures
- Maintain focus on emotional experience

Risk Factors:
- Age-related health considerations
- Potential for complicated grief
- Existential distress
- Sleep disturbances
- Social isolation risk

Strengths:
- Strong support system (family)
- High psychological mindedness
- Previous experience with therapy
- Continued professional engagement
- Willingness to be vulnerable
- Capacity for deep reflection

Cultural Considerations:
- Russian Jewish immigrant background
- Professional identity as psychiatrist
- Academic environment
- Family dynamics and expectations
- Cultural attitudes toward aging and death',
    'en'
  );
  
  -- Create Yalom client conceptualization artifact
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    en_yalom_id,
    'client_conceptualization',
    'Irvin presents with complicated grief following the loss of his wife of 65 years. His symptoms include persistent sadness, sleep disturbance, and existential questioning. As a renowned psychiatrist and existential therapist himself, he has significant insight into his psychological processes, which can be both an asset and a potential barrier to authentic emotional processing.

Psychodynamic formulation suggests that his current grief has activated early attachment patterns and unconscious conflicts related to dependency, vulnerability, and control. His professional identity has served as a defense mechanism that now requires careful navigation in therapy.

Treatment approach:
1. Psychodynamic therapy focusing on unconscious processes and transference
2. Exploration of early life experiences and their influence on current grief
3. Working through ambivalent feelings about his wife and their relationship
4. Addressing existential concerns about mortality, meaning, and legacy

Therapy will require careful attention to the therapeutic relationship, as his professional knowledge may lead to intellectualization as a defense against painful emotions.',
    'en'
  );

  -- Create Yalom client prep note artifact (English)
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    en_yalom_id,
    'client_prep_note',
    'Preparation for Session with Irvin D. Yalom:

Key Discussion Points:
1. Impact of previous session - his reflections on the dream and searching for Marilyn
2. Current emotional state and sleep
3. Progress in communication with children and new insights
4. Existential questions and search for meaning

Therapeutic Goals:
- Support him in exploring feelings of guilt and balance between professional and personal life
- Continue working with transference, using his professional understanding as a resource
- Help integrate his intellectual understanding with emotional experience
- Explore new ways of finding meaning in his current situation

Potential Areas of Resistance:
- Possible intellectualization as a defense mechanism
- Challenges in balancing his roles as therapist and client
- Ambivalence regarding vulnerability

Session Plan:
1. Begin with checking his well-being and any changes since last session
2. Explore any new dreams or memories
3. Delve deeper into his reflections on work-life balance
4. Work with transference if it arises
5. Support him in exploring new ways of finding meaning

Special Considerations:
- Consider his extensive professional experience without letting it dominate the therapeutic process
- Maintain balance between respect for his expertise and creating space for his emotional experience
- Be prepared for deep existential themes
- Pay attention to any signs of complicated grief',
    'en'
  );
  
  -- Create therapy sessions for Yalom (2 sessions)
  -- Session 1: Initial Grief Exploration
  INSERT INTO public.sessions (
    account_id,
    client_id,
    title,
    note
  ) VALUES (
    demo_account_id,
    en_yalom_id,
    'Initial Grief Exploration',
    'Irvin presented with complicated grief following the recent loss of his wife, Marilyn, after 65 years of marriage. Despite his extensive background as a psychiatrist and existential therapist, he acknowledges that his professional knowledge doesn''t shield him from the emotional impact of loss. He reports sleep disturbance, intrusive memories, and profound sadness. Initial session focused on establishing a therapeutic alliance that acknowledges his expertise while creating space for him as a grieving individual. Used psychodynamic approach with attention to transference and resistance, particularly his tendency to intellectualize emotional content. Explored early childhood memories of loss and their potential connection to current grief experience.'
  ) RETURNING id INTO session_id;
  
  -- Create transcript for Yalom's first session
  INSERT INTO public.transcripts (
    account_id,
    session_id,
    transcription_model,
    content,
    content_json
  ) VALUES (
    demo_account_id,
    session_id,
    'demo',
    'Therapist: Dr. Yalom, thank you for coming in today. How would you like me to address you during our sessions?\nClient: Irvin is fine. I\'ve spent decades being called Dr. Yalom, but here... I\'m just a person trying to make sense of loss.\nTherapist: I appreciate that, Irvin. Perhaps we could start with what brings you here today?\nClient: It\'s been eight months since Marilyn died. My wife of 65 years. The pain hasn\'t diminished as everyone said it would. If anything, it\'s become more... existential. I find myself waking at 3 AM, staring at her empty side of the bed, and feeling this overwhelming sense of finitude.\nTherapist: The loss of a life partner after so many decades must create an enormous void.\nClient: Yes, enormous. You know, I\'ve written extensively about death anxiety in my work. I\'ve counseled countless patients through grief. But experiencing it myself... it\'s different. All my intellectual understanding doesn\'t seem to touch the raw experience.\nTherapist: So there\'s a gap between your professional knowledge of grief and your lived experience of it.\nClient: Exactly. And it makes me question how effective I\'ve been as a therapist all these years. Did I truly understand what my patients were going through? Or was I just theorizing from a safe distance?\nTherapist: I\'m struck by how you\'re questioning your professional identity in the wake of this personal loss. I wonder if there might be earlier experiences in your life where you felt this disconnect between understanding and feeling?\nClient: [Long pause] My parents were Russian Jewish immigrants. They worked constantly in their grocery business in Washington D.C. There wasn\'t much emotional expression in our home. When my father died when I was 15, I remember my mother telling me not to cry, that I needed to be strong. I became the man of the house overnight.\nTherapist: So you learned early on to set aside your emotional responses and take on responsibility.\nClient: Yes, I suppose I did. I\'ve never really connected that to my professional development before, but perhaps there\'s something there—this idea that understanding and analyzing might be more valuable than simply feeling.\nTherapist: And now with Marilyn\'s death, you\'re confronted with feelings that can\'t be analyzed away.\nClient: [Tears forming] Yes. I keep thinking about our last few months together. After her cancer diagnosis, we had this... this precious time. We knew it was ending. We said everything that needed to be said. It was beautiful in its way. But now... now I\'m left here, at 93, wondering what my purpose is without her.\nTherapist: It sounds like you\'re facing not only the grief of losing Marilyn but also existential questions about your own remaining time.\nClient: That\'s precisely it. I\'ve built my career around helping people confront their mortality meaningfully. Now I\'m confronting my own, without my life\'s companion. It feels... it feels like standing at the edge of an abyss.',
    '{"segments": [
      {"start_ms": 0, "end_ms": 8000, "speaker": "therapist", "content": "Dr. Yalom, thank you for coming in today. How would you like me to address you during our sessions?"},
      {"start_ms": 8500, "end_ms": 16000, "speaker": "client", "content": "Irvin is fine. I\'ve spent decades being called Dr. Yalom, but here... I\'m just a person trying to make sense of loss."},
      {"start_ms": 16500, "end_ms": 21000, "speaker": "therapist", "content": "I appreciate that, Irvin. Perhaps we could start with what brings you here today?"},
      {"start_ms": 21500, "end_ms": 40000, "speaker": "client", "content": "It\'s been eight months since Marilyn died. My wife of 65 years. The pain hasn\'t diminished as everyone said it would. If anything, it\'s become more... existential. I find myself waking at 3 AM, staring at her empty side of the bed, and feeling this overwhelming sense of finitude."},
      {"start_ms": 40500, "end_ms": 45000, "speaker": "therapist", "content": "The loss of a life partner after so many decades must create an enormous void."},
      {"start_ms": 45500, "end_ms": 60000, "speaker": "client", "content": "Yes, enormous. You know, I\'ve written extensively about death anxiety in my work. I\'ve counseled countless patients through grief. But experiencing it myself... it\'s different. All my intellectual understanding doesn\'t seem to touch the raw experience."},
      {"start_ms": 60500, "end_ms": 67000, "speaker": "therapist", "content": "So there\'s a gap between your professional knowledge of grief and your lived experience of it."},
      {"start_ms": 67500, "end_ms": 80000, "speaker": "client", "content": "Exactly. And it makes me question how effective I\'ve been as a therapist all these years. Did I truly understand what my patients were going through? Or was I just theorizing from a safe distance?"},
      {"start_ms": 80500, "end_ms": 90000, "speaker": "therapist", "content": "I\'m struck by how you\'re questioning your professional identity in the wake of this personal loss. I wonder if there might be earlier experiences in your life where you felt this disconnect between understanding and feeling?"},
      {"start_ms": 90500, "end_ms": 110000, "speaker": "client", "content": "[Long pause] My parents were Russian Jewish immigrants. They worked constantly in their grocery business in Washington D.C. There wasn\'t much emotional expression in our home. When my father died when I was 15, I remember my mother telling me not to cry, that I needed to be strong. I became the man of the house overnight."},
      {"start_ms": 110500, "end_ms": 115000, "speaker": "therapist", "content": "So you learned early on to set aside your emotional responses and take on responsibility."},
      {"start_ms": 115500, "end_ms": 130000, "speaker": "client", "content": "Yes, I suppose I did. I\'ve never really connected that to my professional development before, but perhaps there\'s something there—this idea that understanding and analyzing might be more valuable than simply feeling."},
      {"start_ms": 130500, "end_ms": 135000, "speaker": "therapist", "content": "And now with Marilyn\'s death, you\'re confronted with feelings that can\'t be analyzed away."},
      {"start_ms": 135500, "end_ms": 155000, "speaker": "client", "content": "[Tears forming] Yes. I keep thinking about our last few months together. After her cancer diagnosis, we had this... this precious time. We knew it was ending. We said everything that needed to be said. It was beautiful in its way. But now... now I\'m left here, at 93, wondering what my purpose is without her."},
      {"start_ms": 155500, "end_ms": 162000, "speaker": "therapist", "content": "It sounds like you\'re facing not only the grief of losing Marilyn but also existential questions about your own remaining time."},
      {"start_ms": 162500, "end_ms": 175000, "speaker": "client", "content": "That\'s precisely it. I\'ve built my career around helping people confront their mortality meaningfully. Now I\'m confronting my own, without my life\'s companion. It feels... it feels like standing at the edge of an abyss."}
    ]}'
  );
  
  -- Create session artifacts for Yalom's first session
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_therapist_summary',
    'In this initial session with Irvin, we explored his grief following the loss of his wife of 65 years. Despite his extensive background as a psychiatrist specializing in existential therapy, he is struggling with the emotional reality of loss that transcends his intellectual understanding. Key themes included:

1. The disconnect between his professional knowledge of grief and his lived experience
2. Early childhood experiences with his Russian immigrant parents and his father''s death when he was 15
3. His mother''s message to "be strong" and not express emotion
4. Possible connection between his early emotional suppression and his later professional focus on intellectual understanding
5. Existential questions about meaning and purpose at age 93 without his life partner

Psychodynamic observations: Irvin shows some resistance through intellectualization but was able to connect with deeper emotions as the session progressed. There appears to be unresolved grief from his father''s death that may be activated by his wife''s passing. The therapeutic relationship will require careful navigation of his identity as both a renowned therapist and a vulnerable client. For next session, I plan to explore his dreams and continue examining the connection between his early life experiences and current grief process.',
    'en'
  );
  
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_client_summary',
    'Thank you for our session today, Irvin. I appreciate your willingness to share such profound and personal experiences.

In our discussion, we explored your grief following Marilyn''s passing after 65 years together. We touched on several important themes:

- The gap between intellectual understanding of grief (from your professional work) and the lived emotional experience
- Early experiences in your family of Russian immigrants, particularly around your father''s death when you were 15
- The message you received to "be strong" rather than express emotion
- Your questions about meaning and purpose in this stage of your life

I was struck by your insight about possibly using intellectual understanding as a defense against fully experiencing emotions, and how this pattern may have roots in your childhood experiences.

As we continue our work together, we''ll explore these connections further and create space for both understanding and feeling. Your willingness to engage with these difficult emotions shows tremendous courage.

For our next session, you might want to pay attention to your dreams, as they often provide valuable insights during periods of grief. Also, notice any memories of Marilyn or your father that arise during the week, along with the associated emotions.',
    'en'
  );
  
  -- Session 2: Dreams and Legacy
  INSERT INTO public.sessions (
    account_id,
    client_id,
    title,
    note
  ) VALUES (
    demo_account_id,
    en_yalom_id,
    'Dreams and Legacy',
    'Second session with Irvin focused on a recurring dream he''s been having about Marilyn and his exploration of legacy. He shared a powerful dream where he was searching for Marilyn in their home, hearing her voice but unable to find her. Used psychodynamic approach to explore the symbolism and emotional content of the dream. Discussed his ambivalence about his professional legacy versus his personal relationships. Irvin expressed concern about how his children experienced him as a father, wondering if his professional focus came at a cost to his family relationships. Notable transference emerged as he compared our therapeutic relationship to his own work with patients. Countertransference noted in my desire to reassure him about his professional impact rather than staying with his uncomfortable emotions.'
  ) RETURNING id INTO session_id;
  
  -- Create transcript for the second session
  INSERT INTO public.transcripts (
    account_id,
    session_id,
    transcription_model,
    content,
    content_json
  ) VALUES (
    demo_account_id,
    session_id,
    'demo',
    'Therapist: Welcome back, Irvin. How have you been since our last session?\nClient: I\'ve been reflecting a lot. And I\'ve had this recurring dream about Marilyn that I\'d like to discuss.\nTherapist: I\'d be interested to hear about the dream.\nClient: I\'m in our home in Palo Alto, the one we shared for decades. I hear Marilyn\'s voice calling me from another room. I follow the sound, but when I enter the room, she\'s not there. Her voice comes from yet another room. This continues throughout the house. I never find her, but I keep searching. I wake up with this profound sense of... incompleteness.\nTherapist: What feelings come up for you as you describe this dream?\nClient: [Sighs] Longing. Frustration. But also... guilt, which surprises me.\nTherapist: Tell me more about the guilt.\nClient: I think it relates to something I\'ve been contemplating about my life. I devoted so much of myself to my work—my patients, my writing, my teaching at Stanford. I\'m proud of that work, but I wonder if my children experienced me as... emotionally unavailable in some ways. Marilyn was the heart of our family. She made our home while I was building my career.\nTherapist: So the dream might connect to feelings about not being fully present, not just with Marilyn now that she\'s gone, but perhaps earlier in your relationship as well?\nClient: Yes, that resonates. In the dream, I can hear her, but I can\'t reach her. Maybe that symbolizes something about our relationship. Not that we weren\'t close—we were extraordinarily close—but there were parts of myself I kept focused on my work.\nTherapist: I\'m struck by how you\'re questioning aspects of your life choices now. It seems like you\'re reevaluating the balance between your professional accomplishments and your personal relationships.\nClient: Exactly. At 93, looking back, the books and papers seem less important. What feels most significant are the connections—with Marilyn, with my children and grandchildren. Yet my professional identity has been so central to my sense of self.\nTherapist: There\'s a reckoning happening between different parts of your identity.\nClient: [Thoughtful pause] You know, this reminds me of how I would work with patients. I\'d help them sit with uncomfortable realizations without rushing to reassurance. But being on this side of the conversation is quite different. I find myself wanting you to tell me I was a good husband and father, that my work mattered.\nTherapist: You\'re noticing the transference in our relationship—how you\'re experiencing me in a way that reflects other significant relationships and needs.\nClient: Yes, and I\'m simultaneously analyzing it! [Laughs] Old habits die hard. But there\'s something powerful about being vulnerable in this way. It\'s different from writing about these concepts.\nTherapist: You\'re allowing yourself to experience what you\'ve asked of your patients for decades.\nClient: [Emotional] Yes. And it\'s terrifying and liberating at once. I\'ve written that the two most powerful therapeutic experiences are the acceptance of one\'s mortality and the realization that we must ultimately face our existential isolation alone. I\'m living those truths now, without Marilyn.\nTherapist: How are you finding meaning in this new chapter?\nClient: I\'m still writing. I still connect with colleagues and former students. But I\'m also spending more time with my children, really listening to them. I\'ve been asking them about their experience of me as a father, which I\'ve never done before. It\'s opened up remarkable conversations.\nTherapist: So even in this profound grief, you\'re discovering new ways of relating and understanding.\nClient: Yes. Marilyn\'s death has broken me open in ways I couldn\'t have anticipated. There\'s pain in that breaking, but also... possibility.',
    '{"segments": [
      {"start_ms": 0, "end_ms": 5000, "speaker": "therapist", "content": "Welcome back, Irvin. How have you been since our last session?"},
      {"start_ms": 5500, "end_ms": 12000, "speaker": "client", "content": "I\'ve been reflecting a lot. And I\'ve had this recurring dream about Marilyn that I\'d like to discuss."},
      {"start_ms": 12500, "end_ms": 16000, "speaker": "therapist", "content": "I\'d be interested to hear about the dream."},
      {"start_ms": 16500, "end_ms": 35000, "speaker": "client", "content": "I\'m in our home in Palo Alto, the one we shared for decades. I hear Marilyn\'s voice calling me from another room. I follow the sound, but when I enter the room, she\'s not there. Her voice comes from yet another room. This continues throughout the house. I never find her, but I keep searching. I wake up with this profound sense of... incompleteness."},
      {"start_ms": 35500, "end_ms": 40000, "speaker": "therapist", "content": "What feelings come up for you as you describe this dream?"},
      {"start_ms": 40500, "end_ms": 48000, "speaker": "client", "content": "[Sighs] Longing. Frustration. But also... guilt, which surprises me."},
      {"start_ms": 48500, "end_ms": 52000, "speaker": "therapist", "content": "Tell me more about the guilt."},
      {"start_ms": 52500, "end_ms": 70000, "speaker": "client", "content": "I think it relates to something I\'ve been contemplating about my life. I devoted so much of myself to my work—my patients, my writing, my teaching at Stanford. I\'m proud of that work, but I wonder if my children experienced me as... emotionally unavailable in some ways. Marilyn was the heart of our family. She made our home while I was building my career."},
      {"start_ms": 70500, "end_ms": 78000, "speaker": "therapist", "content": "So the dream might connect to feelings about not being fully present, not just with Marilyn now that she\'s gone, but perhaps earlier in your relationship as well?"},
      {"start_ms": 78500, "end_ms": 90000, "speaker": "client", "content": "Yes, that resonates. In the dream, I can hear her, but I can\'t reach her. Maybe that symbolizes something about our relationship. Not that we weren\'t close—we were extraordinarily close—but there were parts of myself I kept focused on my work."},
      {"start_ms": 90500, "end_ms": 98000, "speaker": "therapist", "content": "I\'m struck by how you\'re questioning aspects of your life choices now. It seems like you\'re reevaluating the balance between your professional accomplishments and your personal relationships."},
      {"start_ms": 98500, "end_ms": 110000, "speaker": "client", "content": "Exactly. At 93, looking back, the books and papers seem less important. What feels most significant are the connections—with Marilyn, with my children and grandchildren. Yet my professional identity has been so central to my sense of self."},
      {"start_ms": 110500, "end_ms": 115000, "speaker": "therapist", "content": "There\'s a reckoning happening between different parts of your identity."},
      {"start_ms": 115500, "end_ms": 135000, "speaker": "client", "content": "[Thoughtful pause] You know, this reminds me of how I would work with patients. I\'d help them sit with uncomfortable realizations without rushing to reassurance. But being on this side of the conversation is quite different. I find myself wanting you to tell me I was a good husband and father, that my work mattered."},
      {"start_ms": 135500, "end_ms": 142000, "speaker": "therapist", "content": "You\'re noticing the transference in our relationship—how you\'re experiencing me in a way that reflects other significant relationships and needs."},
      {"start_ms": 142500, "end_ms": 155000, "speaker": "client", "content": "Yes, and I\'m simultaneously analyzing it! [Laughs] Old habits die hard. But there\'s something powerful about being vulnerable in this way. It\'s different from writing about these concepts."},
      {"start_ms": 155500, "end_ms": 160000, "speaker": "therapist", "content": "You\'re allowing yourself to experience what you\'ve asked of your patients for decades."},
      {"start_ms": 160500, "end_ms": 175000, "speaker": "client", "content": "[Emotional] Yes. And it\'s terrifying and liberating at once. I\'ve written that the two most powerful therapeutic experiences are the acceptance of one\'s mortality and the realization that we must ultimately face our existential isolation alone. I\'m living those truths now, without Marilyn."},
      {"start_ms": 175500, "end_ms": 180000, "speaker": "therapist", "content": "How are you finding meaning in this new chapter?"},
      {"start_ms": 180500, "end_ms": 195000, "speaker": "client", "content": "I\'m still writing. I still connect with colleagues and former students. But I\'m also spending more time with my children, really listening to them. I\'ve been asking them about their experience of me as a father, which I\'ve never done before. It\'s opened up remarkable conversations."},
      {"start_ms": 195500, "end_ms": 200000, "speaker": "therapist", "content": "So even in this profound grief, you\'re discovering new ways of relating and understanding."},
      {"start_ms": 200500, "end_ms": 210000, "speaker": "client", "content": "Yes. Marilyn\'s death has broken me open in ways I couldn\'t have anticipated. There\'s pain in that breaking, but also... possibility."}
    ]}'
  );
  
  -- Create session artifacts for Yalom's second session
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_therapist_summary',
    'In our second session, Irvin shared a significant recurring dream about searching for his late wife, Marilyn, which we explored as a manifestation of his ongoing grief, feelings of incompleteness, and perhaps unresolved guilt. Key themes that emerged included:

1. Dream Analysis: The dream of endlessly searching for Marilyn highlighted feelings of longing, frustration, and a surprising sense of guilt, possibly related to his life''s work and family balance.

2. Legacy and Life Review: Irvin is actively re-evaluating his life, particularly the balance between his extensive professional contributions and his personal relationships, especially with his children. He expressed concerns about his emotional availability to them.

3. Transference and Insight: Irvin demonstrated remarkable insight by identifying and analyzing transference dynamics within our therapeutic relationship, comparing it to his experiences as a therapist.

4. Vulnerability and Growth: He acknowledged the terror and liberation in experiencing vulnerability, a state he often guided his own patients through.

5. Finding New Meaning: Irvin is actively seeking new avenues for meaning, notably by deepening his connections with his children and engaging in open conversations about their experiences.

Psychodynamic observations: The dream provides rich material for understanding unconscious conflicts. Irvin''s intellectual defenses are still present but are increasingly permeable, allowing for deeper emotional processing. Transference is a key element to work with.

Plan: Continue to explore the themes of guilt, legacy, and family relationships. Utilize the transference to deepen understanding. Support his ongoing efforts to find meaning and connection in this new life chapter.',
    'en'
  );

  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_client_summary',
    'Thank you for sharing so openly in our session today, Irvin. Your dream about Marilyn was a powerful starting point for our conversation.

We discussed several important areas:

1. Your Dream: The dream of searching for Marilyn seems to bring up strong feelings like longing, frustration, and even guilt. It also seems connected to your reflections on your life and relationship.

2. Life''s Balance: You''re thoughtfully considering the balance between your impactful career and your personal life, especially your role as a father. It''s natural to reflect on these aspects.

3. Our Therapeutic Space: You astutely observed how our interactions can reflect other important relationships and needs, which is a valuable part of the therapy process.

4. Embracing Vulnerability: You spoke about the dual nature of vulnerability – how it can be both frightening and freeing. This is a courageous path.

5. New Connections: It''s inspiring to hear about the new kinds of conversations you''re having with your children and your continued search for meaning.

As you continue to reflect this week, you might notice how these themes – the dream, your life''s balance, your feelings – connect with your daily experiences and interactions. These insights can be very helpful as we continue our work.',
    'en'
  );

  -- Create Ирвин Д. Ялом Russian demo client
  INSERT INTO public.clients (
    id,
    account_id,
    therapist_id,
    full_name,
    email,
    phone,
    demo
  ) VALUES (
    ru_yalom_id,
    demo_account_id,
    demo_therapist_id,
    'Ирвин Д. Ялом',
    'irvin.yalom@example.com',
    '+1 (650) 555-7890',
    true
  );
  
  -- Create Yalom client bio artifact (Russian)
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    ru_yalom_id,
    'client_bio',
    'Ирвину 93 года, он пенсионер-психиатр и автор, недавно потерявший жену после 65 лет брака. Он обратился за терапией, чтобы переработать свое горе и встретиться лицом к лицу со своей смертностью. Будучи сам пионером экзистенциальной психотерапии, он привносит уникальное понимание в терапевтический процесс, но признает, что его профессиональные знания не защищают его от эмоционального воздействия потери. Он сообщает о трудностях со сном, навязчивых воспоминаниях и периодах глубокой печали. Хотя он поддерживает близкие отношения со своими четырьмя детьми и внуками, он выражает глубокое чувство одиночества и вопросы о своем оставшемся жизненном предназначении. Несмотря на его обширные знания психологических процессов, он ищет пространство для исследования своих эмоций как человек, а не как клиницист.',
    'ru'
  );
  
  -- Create Yalom client conceptualization artifact (Russian)
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    ru_yalom_id,
    'client_conceptualization',
    'Ирвин представляет сложное горе после потери жены после 65 лет брака. Его симптомы включают постоянную печаль, нарушения сна и экзистенциальные вопросы. Как известный психиатр и экзистенциальный терапевт, он имеет значительное понимание своих психологических процессов, что может быть как преимуществом, так и потенциальным барьером для аутентичной эмоциональной обработки.

Психодинамическая формулировка предполагает, что его текущее горе активировало ранние паттерны привязанности и бессознательные конфликты, связанные с зависимостью, уязвимостью и контролем. Его профессиональная идентичность служила защитным механизмом, который теперь требует осторожной навигации в терапии.

Подход к лечению:
1. Психодинамическая терапия, фокусирующаяся на бессознательных процессах и переносе
2. Исследование раннего жизненного опыта и его влияния на текущее горе
3. Проработка амбивалентных чувств по отношению к жене и их отношениям
4. Обращение к экзистенциальным проблемам смертности, смысла и наследия

Терапия потребует внимательного отношения к терапевтическим отношениям, так как его профессиональные знания могут привести к интеллектуализации как защите от болезненных эмоций.',
    'ru'
  );

  -- Create Yalom client prep note artifact (Russian)
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'client',
    ru_yalom_id,
    'client_prep_note',
    'Подготовка к сессии с Ирвином Д. Яломом:

Ключевые моменты для обсуждения:
1. Последствия предыдущей сессии - его размышления о сне и поиске Мэрилин
2. Текущее эмоциональное состояние и сон
3. Прогресс в общении с детьми и новые инсайты
4. Экзистенциальные вопросы и поиск смысла

Терапевтические цели:
- Поддержать его в исследовании чувства вины и баланса между профессиональной и личной жизнью
- Продолжить работу с переносом, используя его профессиональное понимание как ресурс
- Помочь интегрировать его интеллектуальное понимание с эмоциональным опытом
- Исследовать новые способы нахождения смысла в его текущей ситуации

Потенциальные области сопротивления:
- Возможная интеллектуализация как защитный механизм
- Сложности в балансе между его ролями как терапевта и клиента
- Амбивалентность в отношении уязвимости

План сессии:
1. Начать с проверки его самочувствия и любых изменений с прошлой сессии
2. Исследовать любые новые сны или воспоминания
3. Углубиться в его размышления о балансе работы и семьи
4. Работать с переносом, если он возникнет
5. Поддерживать его в исследовании новых способов нахождения смысла

Особые соображения:
- Учитывать его обширный профессиональный опыт, не позволяя ему доминировать над терапевтическим процессом
- Поддерживать баланс между уважением к его экспертизе и созданием пространства для его эмоционального опыта
- Быть готовым к глубоким экзистенциальным темам
- Обращать внимание на любые признаки осложненного горя',
    'ru'
  );

  -- Create therapy sessions for Yalom (2 sessions in Russian)
  -- Session 1: Initial Grief Exploration
  INSERT INTO public.sessions (
    account_id,
    client_id,
    title,
    note
  ) VALUES (
    demo_account_id,
    ru_yalom_id,
    'Начальное исследование горя',
    'Ирвин представился со сложным горем после недавней потери жены, Мэрилин, после 65 лет брака. Несмотря на его обширный опыт как психиатра и экзистенциального терапевта, он признает, что его профессиональные знания не защищают его от эмоционального воздействия потери. Он сообщает о нарушениях сна, навязчивых воспоминаниях и глубокой печали. Начальная сессия была сосредоточена на установлении терапевтического альянса, который признает его опыт, создавая при этом пространство для него как для скорбящего человека. Использовался психодинамический подход с вниманием к переносу и сопротивлению, особенно к его склонности интеллектуализировать эмоциональное содержание. Исследовались ранние детские воспоминания о потере и их потенциальная связь с текущим опытом горя.'
  ) RETURNING id INTO session_id;
  
  -- Create transcript for Yalom's first session (Russian)
  INSERT INTO public.transcripts (
    account_id,
    session_id,
    transcription_model,
    content,
    content_json
  ) VALUES (
    demo_account_id,
    session_id,
    'demo',
    'Терапевт: Доктор Ялом, спасибо, что пришли сегодня. Как бы вы хотели, чтобы я обращался к вам во время наших сессий?\nКлиент: Ирвин подойдет. Я провел десятилетия, будучи доктором Яломом, но здесь... я просто человек, пытающийся осмыслить потерю.\nТерапевт: Я ценю это, Ирвин. Может быть, мы могли бы начать с того, что привело вас сюда сегодня?\nКлиент: Прошло восемь месяцев с тех пор, как умерла Мэрилин. Моя жена, с которой я прожил 65 лет. Боль не уменьшилась, как все говорили. Если что, она стала более... экзистенциальной. Я просыпаюсь в 3 часа ночи, смотрю на ее пустую сторону кровати и чувствую это подавляющее чувство конечности.\nТерапевт: Потеря партнера по жизни после стольких десятилетий должна создавать огромную пустоту.\nКлиент: Да, огромную. Знаете, я много писал о тревоге смерти в своей работе. Я консультировал бесчисленное количество пациентов через горе. Но переживать это самому... это другое. Все мое интеллектуальное понимание, кажется, не затрагивает сырой опыт.\nТерапевт: Значит, есть разрыв между вашим профессиональным знанием горя и вашим пережитым опытом.\nКлиент: Именно так. И это заставляет меня сомневаться в том, насколько эффективным я был как терапевт все эти годы. Действительно ли я понимал, через что проходят мои пациенты? Или я просто теоретизировал с безопасного расстояния?\nТерапевт: Меня поражает, как вы ставите под сомнение свою профессиональную идентичность в свете этой личной потери. Интересно, могли ли быть более ранние переживания в вашей жизни, где вы чувствовали этот разрыв между пониманием и чувствованием?\nКлиент: [Долгая пауза] Мои родители были русскими еврейскими иммигрантами. Они постоянно работали в своем продуктовом бизнесе в Вашингтоне. В нашем доме не было много эмоционального выражения. Когда мой отец умер, когда мне было 15, я помню, как мама говорила мне не плакать, что мне нужно быть сильным. Я стал главой семьи в одночасье.\nТерапевт: Значит, вы рано научились откладывать свои эмоциональные реакции и брать на себя ответственность.\nКлиент: Да, полагаю, так и было. Я никогда раньше не связывал это с моим профессиональным развитием, но, возможно, здесь что-то есть — эта идея, что понимание и анализ могут быть более ценными, чем просто чувствование.\nТерапевт: И теперь, со смертью Мэрилин, вы сталкиваетесь с чувствами, которые нельзя проанализировать.\nКлиент: [Слезы] Да. Я все время думаю о наших последних месяцах вместе. После ее диагноза рака у нас было это... это драгоценное время. Мы знали, что это заканчивается. Мы сказали все, что нужно было сказать. Это было прекрасно по-своему. Но теперь... теперь я остался здесь, в 93 года, задаваясь вопросом, какая моя цель без нее.\nТерапевт: Похоже, вы сталкиваетесь не только с горем потери Мэрилин, но и с экзистенциальными вопросами о своем оставшемся времени.\nКлиент: Именно так. Я построил свою карьеру на том, чтобы помогать людям осмысленно встречаться со своей смертностью. Теперь я встречаюсь со своей, без спутника жизни. Это чувствуется... это чувствуется как стояние на краю пропасти.',
    '{"segments": [
      {"start_ms": 0, "end_ms": 8000, "speaker": "therapist", "content": "Доктор Ялом, спасибо, что пришли сегодня. Как бы вы хотели, чтобы я обращался к вам во время наших сессий?"},
      {"start_ms": 8500, "end_ms": 16000, "speaker": "client", "content": "Ирвин подойдет. Я провел десятилетия, будучи доктором Яломом, но здесь... я просто человек, пытающийся осмыслить потерю."},
      {"start_ms": 16500, "end_ms": 21000, "speaker": "therapist", "content": "Я ценю это, Ирвин. Может быть, мы могли бы начать с того, что привело вас сюда сегодня?"},
      {"start_ms": 21500, "end_ms": 40000, "speaker": "client", "content": "Прошло восемь месяцев с тех пор, как умерла Мэрилин. Моя жена, с которой я прожил 65 лет. Боль не уменьшилась, как все говорили. Если что, она стала более... экзистенциальной. Я просыпаюсь в 3 часа ночи, смотрю на ее пустую сторону кровати и чувствую это подавляющее чувство конечности."},
      {"start_ms": 40500, "end_ms": 45000, "speaker": "therapist", "content": "Потеря партнера по жизни после стольких десятилетий должна создавать огромную пустоту."},
      {"start_ms": 45500, "end_ms": 60000, "speaker": "client", "content": "Да, огромную. Знаете, я много писал о тревоге смерти в своей работе. Я консультировал бесчисленное количество пациентов через горе. Но переживать это самому... это другое. Все мое интеллектуальное понимание, кажется, не затрагивает сырой опыт."},
      {"start_ms": 60500, "end_ms": 67000, "speaker": "therapist", "content": "Значит, есть разрыв между вашим профессиональным знанием горя и вашим пережитым опытом."},
      {"start_ms": 67500, "end_ms": 80000, "speaker": "client", "content": "Именно так. И это заставляет меня сомневаться в том, насколько эффективным я был как терапевт все эти годы. Действительно ли я понимал, через что проходят мои пациенты? Или я просто теоретизировал с безопасного расстояния?"},
      {"start_ms": 80500, "end_ms": 90000, "speaker": "therapist", "content": "Меня поражает, как вы ставите под сомнение свою профессиональную идентичность в свете этой личной потери. Интересно, могли ли быть более ранние переживания в вашей жизни, где вы чувствовали этот разрыв между пониманием и чувствованием?"},
      {"start_ms": 90500, "end_ms": 110000, "speaker": "client", "content": "[Долгая пауза] Мои родители были русскими еврейскими иммигрантами. Они постоянно работали в своем продуктовом бизнесе в Вашингтоне. В нашем доме не было много эмоционального выражения. Когда мой отец умер, когда мне было 15, я помню, как мама говорила мне не плакать, что мне нужно быть сильным. Я стал главой семьи в одночасье."},
      {"start_ms": 110500, "end_ms": 115000, "speaker": "therapist", "content": "Значит, вы рано научились откладывать свои эмоциональные реакции и брать на себя ответственность."},
      {"start_ms": 115500, "end_ms": 130000, "speaker": "client", "content": "Да, полагаю, так и было. Я никогда раньше не связывал это с моим профессиональным развитием, но, возможно, здесь что-то есть — эта идея, что понимание и анализ могут быть более ценными, чем просто чувствование."},
      {"start_ms": 130500, "end_ms": 135000, "speaker": "therapist", "content": "И теперь, со смертью Мэрилин, вы сталкиваетесь с чувствами, которые нельзя проанализировать."},
      {"start_ms": 135500, "end_ms": 155000, "speaker": "client", "content": "[Слезы] Да. Я все время думаю о наших последних месяцах вместе. После ее диагноза рака у нас было это... это драгоценное время. Мы знали, что это заканчивается. Мы сказали все, что нужно было сказать. Это было прекрасно по-своему. Но теперь... теперь я остался здесь, в 93 года, задаваясь вопросом, какая моя цель без нее."},
      {"start_ms": 155500, "end_ms": 162000, "speaker": "therapist", "content": "Похоже, вы сталкиваетесь не только с горем потери Мэрилин, но и с экзистенциальными вопросами о своем оставшемся времени."},
      {"start_ms": 162500, "end_ms": 175000, "speaker": "client", "content": "Именно так. Я построил свою карьеру на том, чтобы помогать людям осмысленно встречаться со своей смертностью. Теперь я встречаюсь со своей, без спутника жизни. Это чувствуется... это чувствуется как стояние на краю пропасти."}
    ]}'
  );

  -- Create session artifacts for Yalom's first session (Russian)
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_therapist_summary',
    'В этой начальной сессии с Ирвином мы исследовали его горе после потери жены после 65 лет брака. Несмотря на его обширный опыт как психиатра, специализирующегося на экзистенциальной терапии, он борется с эмоциональной реальностью потери, которая превосходит его интеллектуальное понимание. Ключевые темы включали:

1. Разрыв между его профессиональным знанием горя и его пережитым опытом
2. Ранний детский опыт с его русскими родителями-иммигрантами и смертью отца, когда ему было 15
3. Послание его матери "быть сильным" и не выражать эмоции
4. Возможная связь между его ранним эмоциональным подавлением и его более поздним профессиональным фокусом на интеллектуальном понимании
5. Экзистенциальные вопросы о смысле и цели в возрасте 93 лет без спутника жизни

Психодинамические наблюдения: Ирвин показывает некоторое сопротивление через интеллектуализацию, но смог связаться с более глубокими эмоциями по мере прогресса сессии. Похоже, есть неразрешенное горе от смерти его отца, которое может быть активировано смертью жены. Терапевтические отношения потребуют осторожной навигации его идентичности как известного терапевта и уязвимого клиента. На следующую сессию я планирую исследовать его сны и продолжить изучение связи между его ранним жизненным опытом и текущим процессом горя.',
    'ru'
  );

  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_client_summary',
    'Спасибо за нашу сессию сегодня, Ирвин. Я ценю вашу готовность делиться такими глубокими и личными переживаниями.

В нашем обсуждении мы исследовали ваше горе после ухода Мэрилин после 65 лет вместе. Мы затронули несколько важных тем:

- Разрыв между интеллектуальным пониманием горя (из вашей профессиональной работы) и пережитым эмоциональным опытом
- Ранний опыт в вашей семье русских иммигрантов, особенно вокруг смерти вашего отца, когда вам было 15
- Послание, которое вы получили "быть сильным", а не выражать эмоции
- Ваши вопросы о смысле и цели на этом этапе вашей жизни

Меня поразило ваше понимание того, как возможно использование интеллектуального понимания как защиты от полного переживания эмоций, и как этот паттерн может иметь корни в вашем детском опыте.

По мере продолжения нашей работы мы будем дальше исследовать эти связи и создавать пространство как для понимания, так и для чувствования. Ваша готовность работать с этими трудными эмоциями показывает огромное мужество.

Для нашей следующей сессии вы можете обратить внимание на свои сны, так как они часто предоставляют ценные инсайты в периоды горя. Также замечайте любые воспоминания о Мэрилин или вашем отце, которые возникают в течение недели, вместе с связанными эмоциями.',
    'ru'
  );

  -- Session 2: Dreams and Legacy (Russian)
  INSERT INTO public.sessions (
    account_id,
    client_id,
    title,
    note
  ) VALUES (
    demo_account_id,
    ru_yalom_id,
    'Сны и наследие',
    'Вторая сессия с Ирвином была сосредоточена на повторяющемся сне о Мэрилин и его исследовании наследия. Он поделился мощным сном, где искал Мэрилин в их доме, слышал ее голос, но не мог найти ее. Использовался психодинамический подход для исследования символики и эмоционального содержания сна. Обсуждалась его амбивалентность по поводу его профессионального наследия в сравнении с личными отношениями. Ирвин выразил беспокойство о том, как его дети воспринимали его как отца, задаваясь вопросом, не пришлось ли его профессиональному фокусу заплатить ценой его семейных отношений. Отмечался заметный перенос, когда он сравнивал наши терапевтические отношения с его собственной работой с пациентами. Отмечен контрперенос в моем желании успокоить его относительно его профессионального влияния, вместо того чтобы оставаться с его неудобными эмоциями.'
  ) RETURNING id INTO session_id;

  -- Create transcript for the second session (Russian)
  INSERT INTO public.transcripts (
    account_id,
    session_id,
    transcription_model,
    content,
    content_json
  ) VALUES (
    demo_account_id,
    session_id,
    'demo',
    'Терапевт: Добро пожаловать обратно, Ирвин. Как вы себя чувствовали с нашей последней сессии?\nКлиент: Я много размышлял. И у меня был этот повторяющийся сон о Мэрилин, который я хотел бы обсудить.\nТерапевт: Мне было бы интересно услышать о сне.\nКлиент: Я в нашем доме в Пало-Альто, том, который мы делили десятилетиями. Я слышу голос Мэрилин, зовущий меня из другой комнаты. Я следую за звуком, но когда вхожу в комнату, ее там нет. Ее голос доносится из еще одной комнаты. Это продолжается по всему дому. Я никогда не нахожу ее, но продолжаю искать. Я просыпаюсь с этим глубоким чувством... незавершенности.\nТерапевт: Какие чувства возникают у вас, когда вы описываете этот сон?\nКлиент: [Вздыхает] Тоска. Разочарование. Но также... вина, что меня удивляет.\nТерапевт: Расскажите больше о вине.\nКлиент: Я думаю, это связано с чем-то, о чем я размышлял в своей жизни. Я посвятил так много себя своей работе — моим пациентам, моему писательству, моему преподаванию в Стэнфорде. Я горжусь этой работой, но я задаюсь вопросом, не воспринимали ли меня мои дети как... эмоционально недоступного в некоторых отношениях. Мэрилин была сердцем нашей семьи. Она создавала наш дом, пока я строил свою карьеру.\nТерапевт: Значит, сон может быть связан с чувствами о том, что вы не были полностью присутствующим, не только с Мэрилин сейчас, когда она ушла, но, возможно, и раньше в ваших отношениях?\nКлиент: Да, это находит отклик. Во сне я слышу ее, но не могу до нее добраться. Может быть, это символизирует что-то о наших отношениях. Не то чтобы мы не были близки — мы были необычайно близки — но были части меня, которые я держал сосредоточенными на моей работе.\nТерапевт: Меня поражает, как вы пересматриваете аспекты своих жизненных выборов сейчас. Похоже, вы переоцениваете баланс между вашими профессиональными достижениями и вашими личными отношениями.\nКлиент: Именно так. В 93 года, оглядываясь назад, книги и статьи кажутся менее важными. Что чувствуется наиболее значимым — это связи — с Мэрилин, с моими детьми и внуками. И все же моя профессиональная идентичность была так центральна для моего чувства себя.\nТерапевт: Происходит переоценка между разными частями вашей идентичности.\nКлиент: [Задумчивая пауза] Знаете, это напоминает мне о том, как я работал с пациентами. Я помогал им сидеть с неудобными осознаниями, не спеша с успокоением. Но быть на этой стороне разговора совсем другое. Я ловлю себя на том, что хочу, чтобы вы сказали мне, что я был хорошим мужем и отцом, что моя работа имела значение.\nТерапевт: Вы замечаете перенос в наших отношениях — как вы переживаете меня способом, который отражает другие значимые отношения и потребности.\nКлиент: Да, и я одновременно анализирую это! [Смеется] Старые привычки умирают с трудом. Но есть что-то мощное в том, чтобы быть уязвимым таким образом. Это отличается от написания об этих концепциях.\nТерапевт: Вы позволяете себе пережить то, о чем вы просили своих пациентов десятилетиями.\nКлиент: [Эмоционально] Да. И это одновременно ужасающе и освобождающе. Я писал, что два самых мощных терапевтических переживания — это принятие своей смертности и осознание, что мы в конечном итоге должны встретиться с нашей экзистенциальной изоляцией в одиночестве. Я живу этими истинами сейчас, без Мэрилин.\nТерапевт: Как вы находите смысл в этой новой главе?\nКлиент: Я все еще пишу. Я все еще общаюсь с коллегами и бывшими студентами. Но я также провожу больше времени с моими детьми, действительно слушая их. Я спрашивал их об их опыте меня как отца, чего я никогда не делал раньше. Это открыло замечательные разговоры.\nТерапевт: Значит, даже в этом глубоком горе вы открываете новые способы отношений и понимания.\nКлиент: Да. Смерть Мэрилин разбила меня открытым способами, которых я не мог предвидеть. В этом разбивании есть боль, но также... возможность.',
    '{"segments": [
      {"start_ms": 0, "end_ms": 5000, "speaker": "therapist", "content": "Добро пожаловать обратно, Ирвин. Как вы себя чувствовали с нашей последней сессии?"},
      {"start_ms": 5500, "end_ms": 12000, "speaker": "client", "content": "Я много размышлял. И у меня был этот повторяющийся сон о Мэрилин, который я хотел бы обсудить."},
      {"start_ms": 12500, "end_ms": 16000, "speaker": "therapist", "content": "Мне было бы интересно услышать о сне."},
      {"start_ms": 16500, "end_ms": 35000, "speaker": "client", "content": "Я в нашем доме в Пало-Альто, том, который мы делили десятилетиями. Я слышу голос Мэрилин, зовущий меня из другой комнаты. Я следую за звуком, но когда вхожу в комнату, ее там нет. Ее голос доносится из еще одной комнаты. Это продолжается по всему дому. Я никогда не нахожу ее, но продолжаю искать. Я просыпаюсь с этим глубоким чувством... незавершенности."},
      {"start_ms": 35500, "end_ms": 40000, "speaker": "therapist", "content": "Какие чувства возникают у вас, когда вы описываете этот сон?"},
      {"start_ms": 40500, "end_ms": 48000, "speaker": "client", "content": "[Вздыхает] Тоска. Разочарование. Но также... вина, что меня удивляет."},
      {"start_ms": 48500, "end_ms": 52000, "speaker": "therapist", "content": "Расскажите больше о вине."},
      {"start_ms": 52500, "end_ms": 70000, "speaker": "client", "content": "Я думаю, это связано с чем-то, о чем я размышлял в своей жизни. Я посвятил так много себя своей работе — моим пациентам, моему писательству, моему преподаванию в Стэнфорде. Я горжусь этой работой, но я задаюсь вопросом, не воспринимали ли меня мои дети как... эмоционально недоступного в некоторых отношениях. Мэрилин была сердцем нашей семьи. Она создавала наш дом, пока я строил свою карьеру."},
      {"start_ms": 70500, "end_ms": 78000, "speaker": "therapist", "content": "Значит, сон может быть связан с чувствами о том, что вы не были полностью присутствующим, не только с Мэрилин сейчас, когда она ушла, но, возможно, и раньше в ваших отношениях?"},
      {"start_ms": 78500, "end_ms": 90000, "speaker": "client", "content": "Да, это находит отклик. Во сне я слышу ее, но не могу до нее добраться. Может быть, это символизирует что-то о наших отношениях. Не то чтобы мы не были близки — мы были необычайно близки — но были части меня, которые я держал сосредоточенными на моей работе."},
      {"start_ms": 90500, "end_ms": 98000, "speaker": "therapist", "content": "Меня поражает, как вы пересматриваете аспекты своих жизненных выборов сейчас. Похоже, вы переоцениваете баланс между вашими профессиональными достижениями и вашими личными отношениями."},
      {"start_ms": 98500, "end_ms": 110000, "speaker": "client", "content": "Именно так. В 93 года, оглядываясь назад, книги и статьи кажутся менее важными. Что чувствуется наиболее значимым — это связи — с Мэрилин, с моими детьми и внуками. И все же моя профессиональная идентичность была так центральна для моего чувства себя."},
      {"start_ms": 110500, "end_ms": 115000, "speaker": "therapist", "content": "Происходит переоценка между разными частями вашей идентичности."},
      {"start_ms": 115500, "end_ms": 135000, "speaker": "client", "content": "[Задумчивая пауза] Знаете, это напоминает мне о том, как я работал с пациентами. Я помогал им сидеть с неудобными осознаниями, не спеша с успокоением. Но быть на этой стороне разговора совсем другое. Я ловлю себя на том, что хочу, чтобы вы сказали мне, что я был хорошим мужем и отцом, что моя работа имела значение."},
      {"start_ms": 135500, "end_ms": 142000, "speaker": "therapist", "content": "Вы замечаете перенос в наших отношениях — как вы переживаете меня способом, который отражает другие значимые отношения и потребности."},
      {"start_ms": 142500, "end_ms": 155000, "speaker": "client", "content": "Да, и я одновременно анализирую это! [Смеется] Старые привычки умирают с трудом. Но есть что-то мощное в том, чтобы быть уязвимым таким образом. Это отличается от написания об этих концепциях."},
      {"start_ms": 155500, "end_ms": 160000, "speaker": "therapist", "content": "Вы позволяете себе пережить то, о чем вы просили своих пациентов десятилетиями."},
      {"start_ms": 160500, "end_ms": 175000, "speaker": "client", "content": "[Эмоционально] Да. И это одновременно ужасающе и освобождающе. Я писал, что два самых мощных терапевтических переживания — это принятие своей смертности и осознание, что мы в конечном итоге должны встретиться с нашей экзистенциальной изоляцией в одиночестве. Я живу этими истинами сейчас, без Мэрилин."},
      {"start_ms": 175500, "end_ms": 180000, "speaker": "therapist", "content": "Как вы находите смысл в этой новой главе?"},
      {"start_ms": 180500, "end_ms": 195000, "speaker": "client", "content": "Я все еще пишу. Я все еще общаюсь с коллегами и бывшими студентами. Но я также провожу больше времени с моими детьми, действительно слушая их. Я спрашивал их об их опыте меня как отца, чего я никогда не делал раньше. Это открыло замечательные разговоры."},
      {"start_ms": 195500, "end_ms": 200000, "speaker": "therapist", "content": "Значит, даже в этом глубоком горе вы открываете новые способы отношений и понимания."},
      {"start_ms": 200500, "end_ms": 210000, "speaker": "client", "content": "Да. Смерть Мэрилин разбила меня открытым способами, которых я не мог предвидеть. В этом разбивании есть боль, но также... возможность."}
    ]}'
  );

  -- Create session artifacts for Yalom's second session (Russian)
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_therapist_summary',
    'В нашей второй сессии Ирвин поделился значительным повторяющимся сном о поиске его покойной жены, Мэрилин, который мы исследовали как проявление его продолжающегося горя, чувств незавершенности и, возможно, неразрешенной вины. Ключевые темы, которые возникли, включали:

1. Анализ сна: Сон о бесконечном поиске Мэрилин высветил чувства тоски, разочарования и удивительное чувство вины, возможно, связанное с балансом его жизненной работы и семьи.

2. Наследие и пересмотр жизни: Ирвин активно переоценивает свою жизнь, особенно баланс между его обширными профессиональными вкладами и его личными отношениями, особенно с детьми. Он выразил беспокойство о своей эмоциональной доступности для них.

3. Перенос и инсайт: Ирвин продемонстрировал замечательное понимание, идентифицируя и анализируя динамику переноса в наших терапевтических отношениях, сравнивая это с его опытом как терапевта.

4. Уязвимость и рост: Он признал ужас и освобождение в переживании уязвимости, состояние, через которое он часто направлял своих собственных пациентов.

5. Поиск нового смысла: Ирвин активно ищет новые пути для смысла, особенно углубляя свои связи с детьми и вступая в открытые разговоры об их опыте.

Психодинамические наблюдения: Сон предоставляет богатый материал для понимания бессознательных конфликтов. Интеллектуальные защиты Ирвина все еще присутствуют, но становятся все более проницаемыми, позволяя более глубокую эмоциональную обработку. Перенос является ключевым элементом для работы.

План: Продолжить исследовать темы вины, наследия и семейных отношений. Использовать перенос для углубления понимания. Поддерживать его продолжающиеся усилия найти смысл и связь в этой новой жизненной главе.',
    'ru'
  );

  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language
  ) VALUES (
    demo_account_id,
    'session',
    session_id,
    'session_client_summary',
    'Спасибо, что так открыто поделились в нашей сессии сегодня, Ирвин. Ваш сон о Мэрилин был мощной отправной точкой для нашего разговора.

Мы обсудили несколько важных областей:

1. Ваш сон: Сон о поиске Мэрилин, кажется, вызывает сильные чувства, такие как тоска, разочарование и даже вина. Он также кажется связанным с вашими размышлениями о вашей жизни и отношениях.

2. Life's Balance: Вы вдумчиво рассматриваете баланс между вашей влиятельной карьерой и вашей личной жизнью, особенно вашей ролью как отца. Естественно размышлять об этих аспектах.

3. Наше терапевтическое пространство: Вы проницательно заметили, как наши взаимодействия могут отражать другие важные отношения и потребности, что является ценной частью терапевтического процесса.

4. Embracing Vulnerability: Вы говорили о двойственной природе уязвимости – как она может быть одновременно пугающей и освобождающей. Это мужественный путь.

5. Новые связи: Вдохновляюще слышать о новых видах разговоров, которые вы ведете с вашими детьми, и вашем продолжающемся поиске смысла.

Пока вы продолжаете размышлять на этой неделе, вы можете заметить, как эти темы – сон, баланс вашей жизни, ваши чувства – связываются с вашими повседневными переживаниями и взаимодействиями. Эти инсайты могут быть очень полезны, пока мы продолжаем нашу работу.',
    'ru'
  );

END
$$;